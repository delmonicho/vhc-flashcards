-- Bulk update breakdown on multiple flashcards in a single query.
-- Used by batchGetOrCreateBreakdowns() to replace N individual UPDATE calls.
-- RLS still applies: only updates cards owned by the calling user.
CREATE OR REPLACE FUNCTION bulk_update_card_breakdowns(updates jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE flashcards f
  SET breakdown = v.breakdown
  FROM jsonb_to_recordset(updates) AS v(id uuid, breakdown jsonb)
  WHERE f.id = v.id
    AND f.user_id = auth.uid();
$$;
