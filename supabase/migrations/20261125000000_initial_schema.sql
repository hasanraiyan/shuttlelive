-- ShuttleLive Initial Multi-Tenant Schema & Authoritative Scoring Engine
-- Version: 1.3.0

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organizations (Tenant Workspaces)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    primary_color VARCHAR(10) DEFAULT '#10b981',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(30) DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'TOURNAMENT_DIRECTOR', 'MEMBER')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    edition_season VARCHAR(100),
    organizer_display_name VARCHAR(255) NOT NULL,
    organizer_contact_email VARCHAR(255),
    organizer_contact_phone VARCHAR(50),
    official_website_url TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
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

-- 5. Tournament Branding & Custom Appearance
CREATE TABLE IF NOT EXISTS tournament_branding (
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

-- 6. Tournament Members (Collaborators & Umpires)
CREATE TABLE IF NOT EXISTS tournament_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(30) DEFAULT 'COLLABORATOR' CHECK (role IN ('ORGANIZER', 'CO_ORGANIZER', 'COLLABORATOR', 'UMPIRE')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- 7. Tournament Sponsors
CREATE TABLE IF NOT EXISTS tournament_sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tier VARCHAR(50) DEFAULT 'ASSOCIATE' CHECK (tier IN ('TITLE', 'POWERED_BY', 'ASSOCIATE', 'EQUIPMENT', 'MEDIA')),
    logo_url TEXT NOT NULL,
    website_url TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Slug Redirects (Handles 301 Permanent Redirects on Slug Change)
CREATE TABLE IF NOT EXISTS slug_redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    previous_slug VARCHAR(255) UNIQUE NOT NULL,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Courts
CREATE TABLE IF NOT EXISTS courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Categories (MS, WS, MD, WD, XD, Open)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('SINGLES', 'DOUBLES', 'TEAM_TIE')),
    gender_eligibility VARCHAR(20) DEFAULT 'OPEN' CHECK (gender_eligibility IN ('MEN', 'WOMEN', 'MIXED', 'OPEN')),
    format VARCHAR(30) DEFAULT 'KNOCKOUT' CHECK (format IN ('KNOCKOUT', 'ROUND_ROBIN', 'GROUP_KNOCKOUT')),
    rule_preset VARCHAR(30) DEFAULT 'BWF_STANDARD',
    rules_override JSONB,
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Category Rounds
CREATE TABLE IF NOT EXISTS category_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    round_name VARCHAR(100) NOT NULL,
    round_order INT NOT NULL,
    rules_override JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Teams / Clubs / Departments
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(10),
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Players
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    gender VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    department VARCHAR(100),
    student_id VARCHAR(50),
    phone VARCHAR(30),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Entries (Match Contestants: 1 Player for Singles, 2 for Doubles)
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    display_name VARCHAR(255) NOT NULL,
    seed_number INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Entry Members
CREATE TABLE IF NOT EXISTS entry_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID REFERENCES entries(id) ON DELETE CASCADE NOT NULL,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(entry_id, player_id)
);

-- 16. Matches
CREATE TABLE IF NOT EXISTS matches (
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
    rules_snapshot JSONB NOT NULL DEFAULT '{"best_of":3,"points_to_win":21,"win_by":2,"max_points":30,"interval_at":11}'::jsonb,
    version INT DEFAULT 1 NOT NULL,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Match Games
CREATE TABLE IF NOT EXISTS match_games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    game_number INT NOT NULL,
    score_a INT DEFAULT 0 NOT NULL,
    score_b INT DEFAULT 0 NOT NULL,
    winner_side VARCHAR(1) CHECK (winner_side IN ('A', 'B', NULL)),
    duration_seconds INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, game_number)
);

-- 18. Match Events (Append-Only Event Sourcing)
CREATE TABLE IF NOT EXISTS match_events (
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
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id, sequence),
    UNIQUE(match_id, client_event_id)
);

-- 19. Match Assignments (Fast-Pass PIN & Referee Assignment)
CREATE TABLE IF NOT EXISTS match_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_pin VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 20. Trigram GIN Search Indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_search ON tournaments 
USING gin (name gin_trgm_ops, organizer_display_name gin_trgm_ops, venue_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_players_search ON players 
USING gin (name gin_trgm_ops, department gin_trgm_ops);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- Public Spectator Read Policies (Any public user can read published tournament content)
CREATE POLICY "Public read published tournaments"
ON tournaments FOR SELECT
TO anon, authenticated
USING (visibility = 'PUBLIC' AND status != 'DRAFT');

CREATE POLICY "Public read published branding"
ON tournament_branding FOR SELECT
TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = tournament_branding.tournament_id 
    AND tournaments.visibility = 'PUBLIC' AND tournaments.status != 'DRAFT'
));

CREATE POLICY "Public read published matches"
ON matches FOR SELECT
TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.visibility = 'PUBLIC' AND tournaments.status != 'DRAFT'
));

CREATE POLICY "Public read match games"
ON match_games FOR SELECT
TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM matches 
    JOIN tournaments ON tournaments.id = matches.tournament_id
    WHERE matches.id = match_games.match_id 
    AND tournaments.visibility = 'PUBLIC' AND tournaments.status != 'DRAFT'
));

CREATE POLICY "Public read match events"
ON match_events FOR SELECT
TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM matches 
    JOIN tournaments ON tournaments.id = matches.tournament_id
    WHERE matches.id = match_events.match_id 
    AND tournaments.visibility = 'PUBLIC' AND tournaments.status != 'DRAFT'
));

-- Organizer Policies (Organizers have full control of their tournaments)
CREATE POLICY "Organizers manage own tournaments"
ON tournaments FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Organizers manage tournament branding"
ON tournament_branding FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = tournament_branding.tournament_id 
    AND tournaments.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = tournament_branding.tournament_id 
    AND tournaments.owner_id = auth.uid()
));

CREATE POLICY "Organizers manage matches"
ON matches FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND tournaments.owner_id = auth.uid()
));

-- ============================================================================
-- AUTHORITATIVE SCORING ENGINE RPC (plpgsql)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_point_event(
    p_match_id UUID,
    p_side VARCHAR(1),
    p_client_event_id VARCHAR(100),
    p_expected_version INT,
    p_scorer_id UUID DEFAULT NULL
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
    -- 1. Idempotency Check
    SELECT id INTO v_existing_event 
    FROM match_events 
    WHERE match_id = p_match_id AND client_event_id = p_client_event_id;
    
    IF v_existing_event IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true, 'message', 'Event already processed');
    END IF;

    -- 2. Lock Match Row & Validate Version
    SELECT * INTO v_match 
    FROM matches 
    WHERE id = p_match_id FOR UPDATE;

    IF v_match.status NOT IN ('LIVE', 'INTERVAL') THEN
        RAISE EXCEPTION 'Match is not in playable state: %', v_match.status;
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

    -- 4. Increment Point
    IF p_side = 'A' THEN
        v_score_a := v_score_a + 1;
        v_next_serving := 'A';
    ELSE
        v_score_b := v_score_b + 1;
        v_next_serving := 'B';
    END IF;

    v_target_pts  := COALESCE((v_match.rules_snapshot->>'points_to_win')::INT, 21);
    v_cap_pts     := COALESCE((v_match.rules_snapshot->>'max_points')::INT, 30);
    v_win_by      := COALESCE((v_match.rules_snapshot->>'win_by')::INT, 2);
    v_best_of     := COALESCE((v_match.rules_snapshot->>'best_of')::INT, 3);
    v_interval_at := COALESCE((v_match.rules_snapshot->>'interval_at')::INT, 11);

    -- 5. Victory Verification
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

    -- 6. Insert Immutable Point Event
    INSERT INTO match_events (
        match_id, game_number, sequence, event_type, side,
        score_a_before, score_b_before, score_a_after, score_b_after,
        client_event_id, created_by
    ) VALUES (
        p_match_id, v_match.current_game, v_new_version, 'POINT_WON', p_side,
        v_game.score_a, v_game.score_b, v_score_a, v_score_b,
        p_client_event_id, p_scorer_id
    );

    -- 7. Update Game & Match Row
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
