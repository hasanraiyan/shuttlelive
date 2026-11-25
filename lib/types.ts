// Row shapes for the Phase 0 schema (supabase/migrations/20261125000003_p0_secure_core.sql).

export type TournamentStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";
export type Visibility = "PUBLIC" | "UNLISTED";
export type CategoryKind = "SINGLES" | "DOUBLES";
export type RulePreset = "BWF_21" | "BAI_15" | "QUICK_21" | "SHORT_15";
export type Side = "A" | "B";
export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "GAME_ENDED"
  | "MATCH_WON_PENDING"
  | "FINALIZED"
  | "TERMINATED";
export type ResultReason = "NORMAL" | "WALKOVER" | "RETIREMENT" | "DISQUALIFICATION" | "BYE";
export type MatchCommand = "START" | "POINT" | "UNDO" | "NEXT_GAME" | "CONFIRM" | "TERMINATE";

export type Tournament = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  host_name: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_map_url: string | null;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
  visibility: Visibility;
  logo_path: string | null;
  banner_path: string | null;
  kind: "TOURNAMENT" | "QUICK";
  brand_primary: string | null;
  brand_accent: string | null;
  voice_assistant_enabled?: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
};

export type OrgRole = "OWNER" | "ORGANIZER";

export type Organization = {
  id: string;
  name: string;
  logo_path: string | null;
  created_by: string | null;
  created_at: string;
};

export type OrgMember = { organization_id: string; user_id: string; role: OrgRole; email: string | null; created_at: string };

export type OrgInvite = {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

/** One row of the public commentary feed (see match_commentary()). */
export type CommentaryEvent = {
  seq: number;
  command: "START" | "POINT" | "NEXT_GAME" | "CONFIRM" | "TERMINATE";
  side: Side | null;
  reason: string | null;
  at: string;
  game: number;
  a: number;
  b: number;
  ga: number;
  gb: number;
  status: MatchStatus;
};

export type Court = { id: string; tournament_id: string; name: string; sort_order: number };

export type Category = {
  id: string;
  tournament_id: string;
  name: string;
  kind: CategoryKind;
  rule_preset: RulePreset;
  created_at: string;
};

export type Player = { id: string; tournament_id: string; name: string; club: string | null; created_at: string };

export type Entry = {
  id: string;
  tournament_id: string;
  category_id: string;
  player1_id: string;
  player2_id: string | null;
  seed: number | null;
  display_name: string;
};

export type Rules = { best_of: number; points: number; cap: number; interval_at: number };

export type Game = { game_number: number; score_a: number; score_b: number; winner_side: Side | null };

export type Match = {
  id: string;
  tournament_id: string;
  category_id: string;
  round: number;
  position: number | null;
  court_id: string | null;
  entry_a_id: string | null;
  entry_b_id: string | null;
  next_match_id: string | null;
  next_slot: Side | null;
  status: MatchStatus;
  result_reason: ResultReason | null;
  rules: Rules;
  current_game: number;
  serving_side: Side | null;
  score_a: number;
  score_b: number;
  games_won_a: number;
  games_won_b: number;
  winner_side: Side | null;
  version: number;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type MatchWithGames = Match & { games: Game[] };

/** Result shape every server action returns. */
export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
