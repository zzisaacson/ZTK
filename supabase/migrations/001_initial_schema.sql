-- ============================================================
-- Zero To Kumziz — Initial Schema
-- Migration: 001_initial_schema.sql
-- Run via: supabase db reset  (local)  or  supabase db push  (remote)
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────

-- pgcrypto supplies gen_random_uuid() on older Postgres versions.
-- On Postgres 13+ the built-in gen_random_uuid() is available without it,
-- but enabling it here is harmless and keeps the migration portable.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM types ───────────────────────────────────────────────────────────────

CREATE TYPE module_type      AS ENUM ('tutorial', 'workout', 'song');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined');

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- One row per Supabase Auth user.
-- id mirrors auth.users.id so foreign-key joins are O(1) PK lookups.

CREATE TABLE profiles (
    id             uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username       text        UNIQUE NOT NULL,
    display_name   text        NOT NULL,
    email          text        NOT NULL,
    avatar         text        NOT NULL DEFAULT '🎸',   -- emoji avatar
    streak         integer     NOT NULL DEFAULT 0 CHECK (streak >= 0),
    session_count  integer     NOT NULL DEFAULT 0 CHECK (session_count >= 0),
    is_admin       boolean     NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── modules ──────────────────────────────────────────────────────────────────
-- Static catalog — one row per module, never owned by a user.
-- sort_order drives display order within a type.

CREATE TABLE modules (
    id          integer       PRIMARY KEY,
    title       text          NOT NULL,
    type        module_type   NOT NULL,
    sort_order  integer       NOT NULL
);

-- ─── user_module_progress ─────────────────────────────────────────────────────
-- One row per (user, module) pair once the user has attempted the module.
-- stars: 1 = attempted, 2 = good, 3 = perfect.

CREATE TABLE user_module_progress (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    module_id    integer     NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    stars        integer     NOT NULL CHECK (stars BETWEEN 1 AND 3),
    completed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, module_id)
);

CREATE INDEX idx_ump_user_id ON user_module_progress (user_id);

-- ─── achievements ─────────────────────────────────────────────────────────────
-- Static catalog — slug text PK, matches the achievement id convention in code.

CREATE TABLE achievements (
    id          text PRIMARY KEY,   -- e.g. 'first_strum'
    title       text NOT NULL,
    description text NOT NULL
);

-- ─── user_achievements ────────────────────────────────────────────────────────
-- One row per (user, achievement) pair.
-- Pre-populated with unlocked = false at signup; set unlocked = true on earn.

CREATE TABLE user_achievements (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    achievement_id text        NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
    unlocked       boolean     NOT NULL DEFAULT false,
    unlocked_at    timestamptz,            -- null until unlocked = true
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_ua_user_id ON user_achievements (user_id);

-- ─── friendships ──────────────────────────────────────────────────────────────
-- Directed request: requester → addressee.
-- Accepted friendship is queryable from either side via OR in the application layer.
-- The unique constraint prevents duplicate requests in either direction individually;
-- application logic should prevent A→B when B→A already exists.

CREATE TABLE friendships (
    id            uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id  uuid              NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    addressee_id  uuid              NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    status        friendship_status NOT NULL DEFAULT 'pending',
    created_at    timestamptz       NOT NULL DEFAULT now(),
    UNIQUE (requester_id, addressee_id),
    CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_addressee ON friendships (addressee_id);
CREATE INDEX idx_friendships_requester ON friendships (requester_id);

-- ─── messages ─────────────────────────────────────────────────────────────────
-- Admin-to-user inbox. Only rows where sender.is_admin = true should be inserted
-- (enforced by RLS policy below, not by a FK constraint).

CREATE TABLE messages (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id    uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    recipient_id uuid        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    subject      text        NOT NULL DEFAULT '',
    body         text        NOT NULL,
    read         boolean     NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT no_self_message CHECK (sender_id <> recipient_id)
);

CREATE INDEX idx_messages_recipient ON messages (recipient_id);
CREATE INDEX idx_messages_sender    ON messages (sender_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;

-- ─── profiles policies ────────────────────────────────────────────────────────

-- Any authenticated user can read all profiles (needed for friend search / leaderboards).
CREATE POLICY "profiles: authenticated users can read all"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert only their own profile row (id must equal their auth UID).
CREATE POLICY "profiles: users insert own row"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Users can update only their own profile row.
CREATE POLICY "profiles: users update own row"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ─── modules policies ────────────────────────────────────────────────────────

-- Catalog is read-only for all authenticated users; writes go through migrations only.
CREATE POLICY "modules: authenticated read"
    ON modules FOR SELECT
    TO authenticated
    USING (true);

-- ─── user_module_progress policies ───────────────────────────────────────────

CREATE POLICY "ump: users read own progress"
    ON user_module_progress FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "ump: users insert own progress"
    ON user_module_progress FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "ump: users update own progress"
    ON user_module_progress FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─── achievements policies ────────────────────────────────────────────────────

CREATE POLICY "achievements: authenticated read"
    ON achievements FOR SELECT
    TO authenticated
    USING (true);

-- ─── user_achievements policies ───────────────────────────────────────────────

CREATE POLICY "ua: users read own achievements"
    ON user_achievements FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "ua: users insert own achievements"
    ON user_achievements FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can flip unlocked = true on their own rows (app-side logic gates the when).
CREATE POLICY "ua: users update own achievements"
    ON user_achievements FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ─── friendships policies ─────────────────────────────────────────────────────

-- A user can see any friendship row they are a party to.
CREATE POLICY "friendships: parties can read"
    ON friendships FOR SELECT
    TO authenticated
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Only the requester initiates a friendship; requester_id must be their own uid.
CREATE POLICY "friendships: requester can insert"
    ON friendships FOR INSERT
    TO authenticated
    WITH CHECK (requester_id = auth.uid());

-- Only the addressee can accept / decline (update status).
-- The requester may also withdraw a pending request (update their own row).
CREATE POLICY "friendships: parties can update"
    ON friendships FOR UPDATE
    TO authenticated
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Either party can remove (unfriend / cancel request).
CREATE POLICY "friendships: parties can delete"
    ON friendships FOR DELETE
    TO authenticated
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- ─── messages policies ────────────────────────────────────────────────────────

-- Recipients can read their own messages.
CREATE POLICY "messages: recipient can read"
    ON messages FOR SELECT
    TO authenticated
    USING (recipient_id = auth.uid());

-- Only admins (is_admin = true on their profile) can send messages.
-- The sub-select is safe: the profiles row is always readable by authenticated users.
CREATE POLICY "messages: only admins can insert"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND is_admin = true
        )
    );

-- Recipients can mark their own messages as read.
CREATE POLICY "messages: recipient can update read flag"
    ON messages FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());
