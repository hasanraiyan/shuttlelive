export type TournamentVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type TournamentStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
export type MatchStatus =
  | "SCHEDULED"
  | "READY"
  | "WARMUP"
  | "LIVE"
  | "PAUSED"
  | "INTERVAL"
  | "GAME_ENDED"
  | "MATCH_WON_PENDING"
  | "FINALIZED"
  | "TERMINATED";

export type CategoryType = "SINGLES" | "DOUBLES" | "TEAM_TIE";
export type GenderEligibility = "MEN" | "WOMEN" | "MIXED" | "OPEN";
export type ScoringPreset = "BWF_STANDARD" | "BAI_DOMESTIC" | "QUICK_21" | "SHORT_15" | "CUSTOM";

export interface ScoringRules {
  best_of: number;
  points_to_win: number;
  win_by: number;
  max_points: number;
  interval_at: number;
  interval_seconds?: number;
  game_break_seconds?: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  primary_color: string;
  created_by: string;
  created_at: string;
}

export interface Tournament {
  id: string;
  organization_id: string | null;
  owner_id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  edition_season: string | null;
  organizer_display_name: string;
  organizer_contact_email: string | null;
  organizer_contact_phone: string | null;
  official_website_url: string | null;
  social_links: Record<string, string>;
  hashtag: string | null;
  venue_name: string;
  venue_address: string | null;
  venue_google_maps_url: string | null;
  start_date: string;
  end_date: string;
  visibility: TournamentVisibility;
  status: TournamentStatus;
  enable_third_place: boolean;
  created_at: string;
  updated_at: string;
}

export interface TournamentBranding {
  id: string;
  tournament_id: string;
  logo_url: string | null;
  banner_url: string | null;
  host_logo_url: string | null;
  primary_color: string;
  accent_color: string;
  theme_mode: "LIGHT" | "DARK" | "SYSTEM";
  show_sponsors: boolean;
  show_rules_prizes: boolean;
  show_announcements: boolean;
  show_venue_map: boolean;
  show_brackets: boolean;
  show_teams_roster: boolean;
  rules_markdown: string | null;
  prizes_markdown: string | null;
}

export interface Court {
  id: string;
  tournament_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  tournament_id: string;
  name: string;
  type: CategoryType;
  gender_eligibility: GenderEligibility;
  format: "KNOCKOUT" | "ROUND_ROBIN" | "GROUP_KNOCKOUT";
  rule_preset: ScoringPreset;
  rules_override: Partial<ScoringRules> | null;
  is_locked: boolean;
  created_at: string;
}

export interface Player {
  id: string;
  tournament_id: string;
  team_id: string | null;
  name: string;
  display_name: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  department: string | null;
  student_id: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Entry {
  id: string;
  category_id: string;
  team_id: string | null;
  display_name: string;
  seed_number: number | null;
  created_at: string;
  members?: Player[];
}

export interface Match {
  id: string;
  tournament_id: string;
  category_id: string;
  round_id: string;
  court_id: string | null;
  entry_a_id: string | null;
  entry_b_id: string | null;
  status: MatchStatus;
  current_game: number;
  serving_side: "A" | "B" | null;
  games_won_a: number;
  games_won_b: number;
  winner_entry_id: string | null;
  termination_reason: "NORMAL" | "WALKOVER" | "RETIREMENT" | "DISQUALIFICATION" | null;
  next_match_id: string | null;
  next_match_slot: "A" | "B" | null;
  rules_snapshot: ScoringRules;
  version: number;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  finalized_at: string | null;
  created_at: string;
  entry_a?: Entry | null;
  entry_b?: Entry | null;
  court?: Court | null;
  games?: MatchGame[];
}

export interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  score_a: number;
  score_b: number;
  winner_side: "A" | "B" | null;
  duration_seconds: number;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  game_number: number;
  sequence: number;
  event_type:
    | "POINT_WON"
    | "FAULT"
    | "LET"
    | "UNDO"
    | "INTERVAL_START"
    | "INTERVAL_END"
    | "CHANGE_ENDS"
    | "GAME_END"
    | "MATCH_WON_PENDING"
    | "RESULT_CONFIRMED";
  side: "A" | "B" | null;
  score_a_before: number;
  score_b_before: number;
  score_a_after: number;
  score_b_after: number;
  target_event_id: string | null;
  client_event_id: string;
  created_at: string;
}
