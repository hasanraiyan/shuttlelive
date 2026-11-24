-- Migration: Additional Authoritative Match Engine RPCs
-- Version: 1.3.1
-- Includes: undo_point_event, start_match, start_next_game, finalize_match, terminate_match

-- 1. Undo Point Event (Appends UNDO event and restores previous state)
CREATE OR REPLACE FUNCTION undo_point_event(
    p_match_id UUID,
    p_client_event_id VARCHAR(100),
    p_scorer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_game RECORD;
    v_last_event RECORD;
    v_new_version INT;
    v_target_event_id UUID;
BEGIN
    -- Lock Match Row
    SELECT * INTO v_match 
    FROM matches 
    WHERE id = p_match_id FOR UPDATE;

    IF v_match.status NOT IN ('LIVE', 'INTERVAL', 'GAME_ENDED', 'MATCH_WON_PENDING') THEN
        RAISE EXCEPTION 'Cannot undo in match state: %', v_match.status;
    END IF;

    -- Find last reversible POINT_WON or FAULT event
    SELECT * INTO v_last_event
    FROM match_events
    WHERE match_id = p_match_id 
      AND event_type IN ('POINT_WON', 'FAULT')
      AND id NOT IN (
          SELECT target_event_id 
          FROM match_events 
          WHERE match_id = p_match_id AND event_type = 'UNDO' AND target_event_id IS NOT NULL
      )
    ORDER BY sequence DESC
    LIMIT 1;

    IF v_last_event IS NULL THEN
        RAISE EXCEPTION 'No reversible scoring event found.';
    END IF;

    v_new_version := v_match.version + 1;
    v_target_event_id := v_last_event.id;

    -- Lock Game Row of the event being undone
    SELECT * INTO v_game 
    FROM match_games 
    WHERE match_id = p_match_id AND game_number = v_last_event.game_number FOR UPDATE;

    -- Append Immutable UNDO event
    INSERT INTO match_events (
        match_id, game_number, sequence, event_type, side,
        score_a_before, score_b_before, score_a_after, score_b_after,
        target_event_id, client_event_id, created_by
    ) VALUES (
        p_match_id, v_last_event.game_number, v_new_version, 'UNDO', v_last_event.side,
        v_last_event.score_a_after, v_last_event.score_b_after, v_last_event.score_a_before, v_last_event.score_b_before,
        v_target_event_id, p_client_event_id, p_scorer_id
    );

    -- Restore Game Scores
    UPDATE match_games 
    SET score_a = v_last_event.score_a_before,
        score_b = v_last_event.score_b_before,
        winner_side = NULL,
        updated_at = NOW()
    WHERE id = v_game.id;

    -- Restore Match Row (unwind games won if rolling back a game-winning point)
    UPDATE matches 
    SET version = v_new_version,
        current_game = v_last_event.game_number,
        serving_side = v_last_event.side,
        games_won_a = CASE 
            WHEN v_match.games_won_a > 0 AND v_last_event.side = 'A' AND v_match.status IN ('GAME_ENDED', 'MATCH_WON_PENDING') 
            THEN v_match.games_won_a - 1 
            ELSE v_match.games_won_a 
        END,
        games_won_b = CASE 
            WHEN v_match.games_won_b > 0 AND v_last_event.side = 'B' AND v_match.status IN ('GAME_ENDED', 'MATCH_WON_PENDING') 
            THEN v_match.games_won_b - 1 
            ELSE v_match.games_won_b 
        END,
        status = 'LIVE',
        updated_at = NOW()
    WHERE id = p_match_id;

    RETURN jsonb_build_object(
        'success', true,
        'version', v_new_version,
        'game_number', v_last_event.game_number,
        'score_a', v_last_event.score_a_before,
        'score_b', v_last_event.score_b_before,
        'serving_side', v_last_event.side,
        'status', 'LIVE'
    );
END;
$$;

-- 2. Start Match (Records toss, first server, initializes Game 1)
CREATE OR REPLACE FUNCTION start_match(
    p_match_id UUID,
    p_serving_side VARCHAR(1),
    p_scorer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status NOT IN ('SCHEDULED', 'READY', 'WARMUP') THEN
        RAISE EXCEPTION 'Match cannot be started from state: %', v_match.status;
    END IF;

    -- Ensure Game 1 row exists
    INSERT INTO match_games (match_id, game_number, score_a, score_b)
    VALUES (p_match_id, 1, 0, 0)
    ON CONFLICT (match_id, game_number) DO NOTHING;

    -- Record Event
    INSERT INTO match_events (
        match_id, game_number, sequence, event_type, side,
        score_a_before, score_b_before, score_a_after, score_b_after,
        client_event_id, created_by
    ) VALUES (
        p_match_id, 1, v_match.version + 1, 'INTERVAL_START', p_serving_side,
        0, 0, 0, 0, gen_random_uuid()::text, p_scorer_id
    );

    UPDATE matches
    SET status = 'LIVE',
        current_game = 1,
        serving_side = p_serving_side,
        started_at = COALESCE(started_at, NOW()),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    RETURN jsonb_build_object('success', true, 'status', 'LIVE', 'serving_side', p_serving_side);
END;
$$;

-- 3. Start Next Game (Advances to Game 2 or 3 after 120s interval)
CREATE OR REPLACE FUNCTION start_next_game(
    p_match_id UUID,
    p_serving_side VARCHAR(1),
    p_scorer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_next_game INT;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status != 'GAME_ENDED' THEN
        RAISE EXCEPTION 'Match is not in GAME_ENDED state: %', v_match.status;
    END IF;

    v_next_game := v_match.current_game + 1;

    INSERT INTO match_games (match_id, game_number, score_a, score_b)
    VALUES (p_match_id, v_next_game, 0, 0)
    ON CONFLICT (match_id, game_number) DO NOTHING;

    UPDATE matches
    SET status = 'LIVE',
        current_game = v_next_game,
        serving_side = p_serving_side,
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    RETURN jsonb_build_object('success', true, 'status', 'LIVE', 'current_game', v_next_game, 'serving_side', p_serving_side);
END;
$$;

-- 4. Finalize Match & Advance Bracket Winner
CREATE OR REPLACE FUNCTION finalize_match(
    p_match_id UUID,
    p_scorer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_winner_id UUID;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status NOT IN ('MATCH_WON_PENDING', 'LIVE', 'GAME_ENDED') THEN
        RAISE EXCEPTION 'Match cannot be finalized from state: %', v_match.status;
    END IF;

    -- Determine winner entry ID
    IF v_match.games_won_a > v_match.games_won_b THEN
        v_winner_id := v_match.entry_a_id;
    ELSE
        v_winner_id := v_match.entry_b_id;
    END IF;

    -- Update Match to FINALIZED
    UPDATE matches
    SET status = 'FINALIZED',
        winner_entry_id = v_winner_id,
        termination_reason = 'NORMAL',
        ended_at = NOW(),
        finalized_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Advance winner to next bracket match if configured
    IF v_match.next_match_id IS NOT NULL AND v_winner_id IS NOT NULL THEN
        IF v_match.next_match_slot = 'A' THEN
            UPDATE matches SET entry_a_id = v_winner_id, updated_at = NOW() WHERE id = v_match.next_match_id;
        ELSIF v_match.next_match_slot = 'B' THEN
            UPDATE matches SET entry_b_id = v_winner_id, updated_at = NOW() WHERE id = v_match.next_match_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'FINALIZED',
        'winner_entry_id', v_winner_id,
        'next_match_id', v_match.next_match_id
    );
END;
$$;

-- 5. Terminate Match (Walkover, Retirement, Disqualification)
CREATE OR REPLACE FUNCTION terminate_match(
    p_match_id UUID,
    p_winner_entry_id UUID,
    p_reason VARCHAR(30), -- 'WALKOVER', 'RETIREMENT', 'DISQUALIFICATION'
    p_scorer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

    UPDATE matches
    SET status = 'TERMINATED',
        winner_entry_id = p_winner_entry_id,
        termination_reason = p_reason,
        ended_at = NOW(),
        finalized_at = NOW(),
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_match_id;

    -- Advance winner to next bracket match
    IF v_match.next_match_id IS NOT NULL AND p_winner_entry_id IS NOT NULL THEN
        IF v_match.next_match_slot = 'A' THEN
            UPDATE matches SET entry_a_id = p_winner_entry_id, updated_at = NOW() WHERE id = v_match.next_match_id;
        ELSIF v_match.next_match_slot = 'B' THEN
            UPDATE matches SET entry_b_id = p_winner_entry_id, updated_at = NOW() WHERE id = v_match.next_match_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'status', 'TERMINATED',
        'winner_entry_id', p_winner_entry_id,
        'reason', p_reason
    );
END;
$$;
