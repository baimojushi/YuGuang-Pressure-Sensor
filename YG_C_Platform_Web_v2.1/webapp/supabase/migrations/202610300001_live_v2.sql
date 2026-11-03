-- Additive migration for the current V2 backend. Does not import old/demo data.
BEGIN;
CREATE TABLE IF NOT EXISTS public.yuguang_spaces (
  id text PRIMARY KEY CHECK (id = 'live-v2'),
  payload text NOT NULL CHECK (octet_length(payload) <= 8388608),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
ALTER TABLE public.yuguang_spaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.yuguang_spaces FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yuguang_spaces TO service_role;
COMMENT ON TABLE public.yuguang_spaces IS '余光正式版 V2：服务端鉴权，CAS 事务保存聚合状态；不含展示数据';
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('yuguang-audio', 'yuguang-audio', false, 5242880, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac'])
ON CONFLICT (id) DO NOTHING;
COMMIT;
NOTIFY pgrst, 'reload schema';
