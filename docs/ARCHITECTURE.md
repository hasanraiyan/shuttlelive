# Technical Architecture & System Design
## Badminton Live (ShuttleLive) — Multi-Tenant & Supabase-Native Architecture

**Document Version:** 1.3.0  
**Status:** Draft — Pending Review  
**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase Platform (PostgreSQL, Auth, Realtime, Storage, Edge Functions, RPCs)

---

## 1. Supabase-Native Architectural Blueprint

```
                                  [ CLIENT TIER ]
   ┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
   │    Spectator Device       │      Scorer Mobile        │    Organizer Dashboard    │
   │  (Branded Microsite /t/*) │ (Offline Queue + Next.js) │(Branding Studio & Admin)  │
   └─────────────┬─────────────┴─────────────┬─────────────┴─────────────┬─────────────┘
                 │                           │                           │
                 │              ┌────────────▼───────────┐               │
                 │              │    Next.js App Server  │◄──────────────┘
                 │              │ (Edge SSR / App Router)│
                 │              └────────────┬───────────┘
                 │                           │
                 ▼                           ▼
   ┌───────────────────────────────────────────────────────────────────────────────────┐
   │                            SUPABASE NATIVE PLATFORM                               │
   │                                                                                   │
   │  ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐  │
   │  │   Supabase Realtime     │  │  PostgreSQL Engine     │  │   Supabase Auth    │  │
   │  │  • Broadcast (<100ms)   │  │  • Stored RPCs (Atomic)│  │  • Magic Links/OTP │  │
   │  │  • Postgres CDC Changes │  │  • Row Level Security  │  │  • JWT Custom Claim│  │
   │  │  • Presence Tracking    │  │  • pg_trgm Fast Search │  │  • Scorer Fast-Pass│  │
   │  └─────────────────────────┘  └────────────────────────┘  └────────────────────┘  │
   │                                                                                   │
   │  ┌─────────────────────────────────────────────────────────────────────────────┐  │
   │  │ Supabase Storage & Image Transformation Engine                              │  │
   │  │  • On-The-Fly WebP Resizing (?width=400&height=400&format=webp)              │  │
   │  │  • Storage RLS & Signed URLs for Private Tournament Assets                  │  │
   │  └─────────────────────────────────────────────────────────────────────────────┘  │
   └───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase-Specific Platform Capabilities

### 2.1 Supabase Realtime: Tri-Mode Synchronization
Rather than relying solely on database replication polling, ShuttleLive uses all three distinct Supabase Realtime primitives:

```
+-----------------------------------------------------------------------------------------+
|                               SUPABASE REALTIME MODES                                   |
+-------------------+-----------------------------------+---------------------------------+
| Mode              | Technical Channel                 | Application Use Case            |
+-------------------+-----------------------------------+---------------------------------+
| 1. Broadcast      | `supabase.channel('match:123')`   | Sub-100ms instant point delta   |
|                   | `.send({ type: 'broadcast' })`    | from umpire to spectators.      |
+-------------------+-----------------------------------+---------------------------------+
| 2. Postgres CDC   | `postgres_changes` on             | Guarantees permanent state      |
|    (Changes)      | `table: matches, match_events`    | sync across all tabs on commit. |
+-------------------+-----------------------------------+---------------------------------+
| 3. Presence       | `presence.track({ court, role })` | Tracks live umpires on court &  |
|                   |                                   | spectator headcount per match.  |
+-------------------+-----------------------------------+---------------------------------+
```

#### Realtime Latency Optimization Flow:
1. Umpire taps `+1 Point`.
2. Client emits an instantaneous **Supabase Realtime Broadcast** event over WebSockets (`match:id`). Spectators receive and render the incremented point within **~50–100ms**.
3. In parallel, client invokes the authoritative PostgreSQL RPC `record_point_event()`.
4. PostgreSQL commits the transaction, writes to `match_events`, and triggers **Postgres CDC**, which confirms the persistent canonical state to all connected clients.

---

### 2.2 Supabase PostgreSQL Functions (Stored RPCs)
To eliminate race conditions, double network round trips, and client-side logic tampering, all core scoring operations execute inside PostgreSQL as **Atomic Stored Procedures**:

#### Master RPC: `record_point_event()`
```sql
CREATE OR REPLACE FUNCTION record_point_event(
    p_match_id UUID,
    p_side VARCHAR(1),
    p_client_event_id VARCHAR(100),
    p_expected_version INT,
    p_scorer_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_game RECORD;
    v_new_version INT;
    v_score_a INT;
    v_score_b INT;
    v_target_pts INT;
    v_cap_pts INT;
    v_win_by INT;
    v_interval_at INT;
    v_is_game_won BOOLEAN := FALSE;
    v_is_match_won BOOLEAN := FALSE;
    v_games_won_a INT;
    v_games_won_b INT;
    v_best_of INT;
    v_next_serving VARCHAR(1);
    v_existing_event UUID;
BEGIN
    -- 1. Idempotency Check (Prevent duplicate point count on network retry)
    SELECT id INTO v_existing_event 
    FROM match_events 
    WHERE match_id = p_match_id AND client_event_id = p_client_event_id;
    
    IF v_existing_event IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'Event already processed');
    END IF;

    -- 2. Lock Match Row & Check Version (Optimistic Concurrency)
    SELECT * INTO v_match 
    FROM matches 
    WHERE id = p_match_id FOR UPDATE;

    IF v_match.status NOT IN ('LIVE', 'INTERVAL') THEN
        RAISE EXCEPTION 'Match is not in active playable state: %', v_match.status;
    END IF;

    IF v_match.version != p_expected_version THEN
        RAISE EXCEPTION 'VERSION_CONFLICT: Expected %, current %', p_expected_version, v_match.version;
    END IF;

    -- 3. Lock Active Game Row
    SELECT * INTO v_game 
    FROM match_games 
    WHERE match_id = p_match_id AND game_number = v_match.current_game FOR UPDATE;

    v_score_a := v_game.score_a;
    v_score_b := v_game.score_b;

    -- 4. Apply Point
    IF p_side = 'A' THEN
        v_score_a := v_score_a + 1;
        v_next_serving := 'A';
    ELSE
        v_score_b := v_score_b + 1;
        v_next_serving := 'B';
    END IF;

    -- Extract Rule Snapshot
    v_target_pts  := (v_match.rules_snapshot->>'points_to_win')::INT;
    v_cap_pts     := (v_match.rules_snapshot->>'max_points')::INT;
    v_win_by      := (v_match.rules_snapshot->>'win_by')::INT;
    v_best_of     := (v_match.rules_snapshot->>'best_of')::INT;
    v_interval_at := (v_match.rules_snapshot->>'interval_at')::INT;

    -- 5. Check Game Victory Condition
    IF (v_score_a >= v_cap_pts) OR (v_score_a >= v_target_pts AND (v_score_a - v_score_b) >= v_win_by) THEN
        v_is_game_won := TRUE;
    ELSIF (v_score_b >= v_cap_pts) OR (v_score_b >= v_target_pts AND (v_score_b - v_score_a) >= v_win_by) THEN
        v_is_game_won := TRUE;
    END IF;

    v_games_won_a := v_match.games_won_a;
    v_games_won_b := v_match.games_won_b;

    IF v_is_game_won THEN
        IF p_side = 'A' THEN v_games_won_a := v_games_won_a + 1; ELSE v_games_won_b := v_games_won_b + 1; END IF;
        IF v_games_won_a > (v_best_of / 2) OR v_games_won_b > (v_best_of / 2) THEN
            v_is_match_won := TRUE;
        END IF;
    END IF;

    v_new_version := v_match.version + 1;

    -- 6. Insert Immutable Event
    INSERT INTO match_events (
        match_id, game_number, sequence, event_type, side,
        score_a_before, score_b_before, score_a_after, score_b_after,
        client_event_id, created_by
    ) VALUES (
        p_match_id, v_match.current_game, v_new_version, 'POINT_WON', p_side,
        v_game.score_a, v_game.score_b, v_score_a, v_score_b,
        p_client_event_id, p_scorer_id
    );

    -- 7. Update Game & Match State
    UPDATE match_games 
    SET score_a = v_score_a, score_b = v_score_b, updated_at = NOW() 
    WHERE id = v_game.id;

    UPDATE matches 
    SET version = v_new_version,
        serving_side = v_next_serving,
        games_won_a = v_games_won_a,
        games_won_b = v_games_won_b,
        status = CASE 
            WHEN v_is_match_won THEN 'MATCH_WON_PENDING'
            WHEN v_is_game_won THEN 'GAME_ENDED'
            WHEN (v_score_a = v_interval_at OR v_score_b = v_interval_at) AND (v_score_a < v_target_pts AND v_score_b < v_target_pts) THEN 'INTERVAL'
            ELSE 'LIVE'
        END,
        updated_at = NOW()
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
        'success', true,
        'version', v_new_version,
        'score_a', v_score_a,
        'score_b', v_score_b,
        'games_won_a', v_games_won_a,
        'games_won_b', v_games_won_b,
        'is_game_won', v_is_game_won,
        'is_match_won', v_is_match_won,
        'status', CASE WHEN v_is_match_won THEN 'MATCH_WON_PENDING' WHEN v_is_game_won THEN 'GAME_ENDED' ELSE 'LIVE' END
    );
END;
$$;
```

---

### 2.3 Supabase Auth & JWT Custom Claims
1. **Magic Link & One-Time Password (OTP) for Umpires:**
   - Court referees don't need passwords. The tournament organizer generates a 6-digit match assignment PIN or triggers a Supabase Auth OTP via SMS/Email.
2. **Custom Claims in JWT:**
   - Using Supabase Auth hooks, the user's JWT includes:
     ```json
     {
       "user_role": "ORGANIZER",
       "org_id": "7a3e...b1",
       "assigned_match_ids": ["m_01", "m_02"]
     }
     ```
   - Enables PostgreSQL Row Level Security (RLS) to check permissions instantaneously **without running expensive subqueries** against `tournament_members`.

---

### 2.4 Supabase Storage & On-The-Fly Image Transformation
ShuttleLive utilizes built-in **Supabase Image Transformation** (`/render/image/public/...`) to eliminate the need for heavy server-side image processing libraries (e.g., sharp):
- **Logo Delivery:**
  ```
  https://[project-ref].supabase.co/storage/v1/render/image/public/tournament-assets/[tournament_id]/logo.png?width=200&height=200&resize=cover&format=webp&quality=80
  ```
- **Banner Delivery:**
  ```
  https://[project-ref].supabase.co/storage/v1/render/image/public/tournament-assets/[tournament_id]/banner.png?width=1920&height=640&resize=cover&format=webp&quality=85
  ```
- **Mobile Responsive Thumbnails:** Client simply appends `?width=400&format=webp` for lightning-fast mobile loading on 4G.

---

### 2.5 PostgreSQL Trigram Search (`pg_trgm`)
ShuttleLive activates the PostgreSQL `pg_trgm` extension for sub-50ms fuzzy search across public tournaments, teams, and athletes:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_tournaments_search ON tournaments 
USING gin (name gin_trgm_ops, organizer_display_name gin_trgm_ops, venue_name gin_trgm_ops);

CREATE INDEX idx_players_search ON players 
USING gin (name gin_trgm_ops, department gin_trgm_ops);
```

---

## 3. Database Schema & Tables

*(Fully aligned with multi-tenant architecture and Supabase types)*

### 3.1 `organizations`
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    primary_color VARCHAR(10) DEFAULT '#10b981',
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 `tournaments`
```sql
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES auth.users(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    edition_season VARCHAR(100),
    
    organizer_display_name VARCHAR(255) NOT NULL,
    organizer_contact_email VARCHAR(255),
    organizer_contact_phone VARCHAR(50),
    official_website_url TEXT,
    social_links JSONB DEFAULT '{}',
    hashtag VARCHAR(50),
    
    venue_name VARCHAR(255) NOT NULL,
    venue_address TEXT,
    venue_google_maps_url TEXT,
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    visibility VARCHAR(20) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')),
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')),
    enable_third_place BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 `tournament_branding`
```sql
CREATE TABLE tournament_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    logo_url TEXT,
    banner_url TEXT,
    host_logo_url TEXT,
    
    primary_color VARCHAR(10) DEFAULT '#0f172a',
    accent_color VARCHAR(10) DEFAULT '#10b981',
    theme_mode VARCHAR(10) DEFAULT 'SYSTEM' CHECK (theme_mode IN ('LIGHT', 'DARK', 'SYSTEM')),
    
    show_sponsors BOOLEAN DEFAULT TRUE,
    show_rules_prizes BOOLEAN DEFAULT TRUE,
    show_announcements BOOLEAN DEFAULT TRUE,
    show_venue_map BOOLEAN DEFAULT TRUE,
    show_brackets BOOLEAN DEFAULT TRUE,
    show_teams_roster BOOLEAN DEFAULT TRUE,
    
    rules_markdown TEXT,
    prizes_markdown TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 `matches` (Authoritative Fixture Engine)
```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    round_id UUID REFERENCES category_rounds(id) ON DELETE CASCADE NOT NULL,
    court_id UUID REFERENCES courts(id) ON DELETE SET NULL,

    entry_a_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    entry_b_id UUID REFERENCES entries(id) ON DELETE SET NULL,

    status VARCHAR(30) DEFAULT 'SCHEDULED' CHECK (status IN (
        'SCHEDULED', 'READY', 'WARMUP', 'LIVE', 'PAUSED', 'INTERVAL', 
        'GAME_ENDED', 'MATCH_WON_PENDING', 'FINALIZED', 'TERMINATED'
    )),

    current_game INT DEFAULT 1,
    serving_side VARCHAR(1) CHECK (serving_side IN ('A', 'B', NULL)),
    
    games_won_a INT DEFAULT 0,
    games_won_b INT DEFAULT 0,

    winner_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    termination_reason VARCHAR(30) CHECK (termination_reason IN (NULL, 'NORMAL', 'WALKOVER', 'RETIREMENT', 'DISQUALIFICATION')),

    next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    next_match_slot VARCHAR(1) CHECK (next_match_slot IN ('A', 'B', NULL)),

    rules_snapshot JSONB NOT NULL,
    version INT DEFAULT 1 NOT NULL,

    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 `match_events` (Append-Only Event Store)
```sql
CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    game_number INT NOT NULL,
    sequence INT NOT NULL,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'POINT_WON', 'FAULT', 'LET', 'UNDO', 'INTERVAL_START', 'INTERVAL_END',
        'CHANGE_ENDS', 'GAME_END', 'MATCH_WON_PENDING', 'RESULT_CONFIRMED'
    )),
    side VARCHAR(1) CHECK (side IN ('A', 'B', NULL)),
    score_a_before INT NOT NULL,
    score_b_before INT NOT NULL,
    score_a_after INT NOT NULL,
    score_b_after INT NOT NULL,
    target_event_id UUID REFERENCES match_events(id),
    client_event_id VARCHAR(100) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, sequence),
    UNIQUE(match_id, client_event_id)
);
```

---

## 4. Multi-Tenant Row Level Security (RLS)

```sql
-- Enable RLS across core tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_branding ENABLE ROW LEVEL SECURITY;

-- 1. Public can read published tournament records
CREATE POLICY "Public Read Access"
ON tournaments FOR SELECT
USING (visibility = 'PUBLIC' AND status != 'DRAFT');

-- 2. Organizers have full CRUD on their tournaments
CREATE POLICY "Organizer Full Access"
ON tournaments FOR ALL
USING (auth.uid() = owner_id);

-- 3. Public can view live matches of public tournaments
CREATE POLICY "Public Read Matches"
ON matches FOR SELECT
USING (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.visibility = 'PUBLIC'
    AND tournaments.status != 'DRAFT'
));

-- 4. Authorized umpires can execute match scoring RPCs
CREATE POLICY "Assigned Umpire Match Scoring"
ON matches FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM match_assignments 
    WHERE match_assignments.match_id = matches.id 
    AND match_assignments.user_id = auth.uid()
    AND match_assignments.is_active = TRUE
));
```

---

## 5. Storage Security Policies

```sql
-- 1. Public CDN Read for Tournament Assets
CREATE POLICY "Public Asset Read"
ON storage.objects FOR SELECT
USING (bucket_id IN ('tournament-assets', 'organization-assets', 'player-avatars'));

-- 2. Authenticated Organizer Asset Upload
CREATE POLICY "Organizer Asset Upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'tournament-assets' 
    AND auth.role() = 'authenticated'
);
```
