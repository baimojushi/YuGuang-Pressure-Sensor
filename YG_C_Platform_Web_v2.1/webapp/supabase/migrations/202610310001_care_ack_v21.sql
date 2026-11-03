-- YG-IFACE-2.1.0: additive compatibility with legacy normalized schema.
-- Live V2 CAS aggregate public.yuguang_spaces is the active authoritative store.
-- The bridge updates message+receipt in one CAS state transition.
BEGIN;
DO $$
BEGIN
  IF to_regclass('yuguang.messages') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE yuguang.messages ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz';
    EXECUTE 'COMMENT ON COLUMN yuguang.messages.acknowledged_at IS ''Optional legacy projection, current Web V2 writes yuguang_spaces''';
  END IF;
END $$;
COMMIT;
