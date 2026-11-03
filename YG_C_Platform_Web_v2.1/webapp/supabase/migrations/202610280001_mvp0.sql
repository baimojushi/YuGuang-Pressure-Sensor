-- 余光 MVP 0：独立业务 schema，供受信任后端连接；不开放浏览器直接读写。
CREATE SCHEMA IF NOT EXISTS yuguang;
CREATE TABLE IF NOT EXISTS yuguang.users (
 id text PRIMARY KEY, name text NOT NULL, account text UNIQUE NOT NULL,
 password text NOT NULL, role text NOT NULL CHECK (role IN ('sender','receiver'))
);
CREATE TABLE IF NOT EXISTS yuguang.sessions (
 token text PRIMARY KEY, user_id text REFERENCES yuguang.users(id), expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS yuguang.pairs (
 id text PRIMARY KEY, sender_id text NOT NULL REFERENCES yuguang.users(id),
 receiver_id text NOT NULL REFERENCES yuguang.users(id), active integer NOT NULL CHECK(active IN (0,1)),
 created bigint NOT NULL, CHECK(sender_id<>receiver_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_sender ON yuguang.pairs(sender_id) WHERE active=1;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_receiver ON yuguang.pairs(receiver_id) WHERE active=1;
CREATE TABLE IF NOT EXISTS yuguang.invites (
 code text PRIMARY KEY, owner_id text REFERENCES yuguang.users(id), expires bigint NOT NULL,
 used integer NOT NULL DEFAULT 0 CHECK(used IN (0,1))
);
CREATE TABLE IF NOT EXISTS yuguang.devices (
 id text PRIMARY KEY, owner_id text UNIQUE REFERENCES yuguang.users(id), key_hash text NOT NULL,
 focus integer DEFAULT 0 CHECK(focus IN (0,1)), power integer DEFAULT 1 CHECK(power IN (0,1)), last_seen bigint DEFAULT 0
);
CREATE TABLE IF NOT EXISTS yuguang.uploads (
 id text PRIMARY KEY, owner_id text REFERENCES yuguang.users(id), path text NOT NULL,
 mime text NOT NULL, size bigint NOT NULL, created bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS yuguang.messages (
 id text PRIMARY KEY, pair_id text REFERENCES yuguang.pairs(id),
 sender_id text REFERENCES yuguang.users(id), receiver_id text REFERENCES yuguang.users(id),
 intent text NOT NULL CHECK(intent IN ('miss','meal','rest','cheer')), note text DEFAULT '' CHECK(length(note)<=140),
 audio_id text REFERENCES yuguang.uploads(id), status text NOT NULL CHECK(status IN ('queued','delivered','received')),
 created bigint NOT NULL, delivered bigint, received bigint, client_id text NOT NULL, UNIQUE(sender_id,client_id)
);
CREATE INDEX IF NOT EXISTS messages_queue ON yuguang.messages(pair_id,status,created);
CREATE TABLE IF NOT EXISTS yuguang.commands (
 id text PRIMARY KEY, device_id text REFERENCES yuguang.devices(id), pair_id text REFERENCES yuguang.pairs(id),
 intent text NOT NULL CHECK(intent IN ('miss','meal','rest','cheer')), message_ids text NOT NULL,
 status text NOT NULL CHECK(status IN ('offered','delivered','received','cancelled')),
 created bigint NOT NULL, delivered bigint, received bigint
);
CREATE INDEX IF NOT EXISTS active_commands ON yuguang.commands(device_id,status,created);
CREATE TABLE IF NOT EXISTS yuguang.touches (
 event_id text PRIMARY KEY, command_id text REFERENCES yuguang.commands(id), created bigint NOT NULL
);
-- App 和硬件均经 Node 后端鉴权。未配置浏览器直连策略前不向匿名/登录 API 角色放行。
REVOKE ALL ON SCHEMA yuguang FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA yuguang FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA yuguang REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER TABLE yuguang.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE yuguang.touches ENABLE ROW LEVEL SECURITY;
