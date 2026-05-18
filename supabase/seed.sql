-- ============================================================
-- Zero To Kumziz — Seed Data
-- Run via: supabase db reset  (applies migrations then this file)
-- ============================================================

-- ─── IMPORTANT: Auth user UUIDs ───────────────────────────────────────────────
--
-- Supabase Auth manages user identities in the auth.users table, which lives in
-- the auth schema and is NOT directly writable in normal migrations.
--
-- To wire up real auth:
--   1. Create both users in the Supabase Dashboard → Authentication → Users
--      (or via `supabase auth users create` in the CLI).
--   2. Copy the UUIDs Supabase assigns to each user.
--   3. Replace the two placeholder UUIDs below with the real ones.
--   4. Re-run `supabase db reset` (local) or apply the seed manually (remote).
--
-- Until you do this, the profiles insert will fail with a FK violation because
-- auth.users will not have rows with these UUIDs.
--
-- Placeholder UUID (replace before running against a real Auth instance):
--   Alec Dron  → 00000000-0000-0000-0000-000000000001

-- ─── Modules catalog ──────────────────────────────────────────────────────────

INSERT INTO modules (id, title, type, sort_order) VALUES
    -- Tutorials
    (1,  'Em & Am',               'tutorial', 1),
    (2,  'G & D Chords',          'tutorial', 2),
    (3,  'Barre Chords',          'tutorial', 3),
    (4,  'Power Chords',          'tutorial', 4),
    (5,  'Fingerpicking',         'tutorial', 5),
    (6,  'Chord Theory',          'tutorial', 6),
    (7,  'Jewish Modes',          'tutorial', 7),
    (8,  'Advanced Techniques',   'tutorial', 8),
    -- Workouts
    (9,  'Chord Changes',         'workout',  1),
    (10, 'Strumming Patterns',    'workout',  2),
    (11, 'Scale Runs',            'workout',  3),
    (12, 'Fingerpicking Speed',   'workout',  4),
    (13, 'Rhythm Mastery',        'workout',  5),
    (14, 'Lead Expression',       'workout',  6),
    -- Songs
    (15, 'First Song',                   'song', 1),
    (16, 'Wonderwall',                   'song', 2),
    (17, 'Knockin'' On Heaven''s Door',  'song', 3),
    (18, 'Yerushalayim Shel Zahav',      'song', 4),
    (19, 'Od Yishama',                   'song', 5),
    (20, 'Hava Nagila',                  'song', 6);

-- ─── Achievements catalog ─────────────────────────────────────────────────────

INSERT INTO achievements (id, title, description) VALUES
    ('first_strum',       'First Strum',       'Play your first clean chord'),
    ('three_day_fire',    '3-Day Fire',         'Practice 3 days in a row'),
    ('kumzitz_starter',   'Kumzitz Starter',    'Play your first Jewish song'),
    ('kumzitz_leader',    'Kumzitz Leader',     'Play 5 full songs'),
    ('niggun_master',     'Niggun Master',      'Learn 10 Jewish songs'),
    ('seven_day_streak',  '7-Day Streak',       'Practice 7 days straight'),
    ('thirty_day_streak', '30-Day Streak',      'Practice for an entire month'),
    ('consistency_king',  'Consistency King',   'Practice 50 sessions total');

-- ─── User profiles ────────────────────────────────────────────────────────────
-- Replace the UUID below with the one Supabase assigns after creating the Auth user
-- in Dashboard → Authentication → Users → Add user.

INSERT INTO profiles (id, username, display_name, email, avatar, streak, session_count, is_admin)
VALUES
    (
        '00000000-0000-0000-0000-000000000001',
        'alecdron',
        'Alec Dron',
        'alecdron@gmail.com',
        '🎸',
        0,
        0,
        true
    );

-- ─── user_achievements — all 8 achievements pre-seeded as locked ───────────────
-- When the app evaluates an achievement criterion it does an UPDATE (not INSERT),
-- so these rows must exist upfront. unlocked_at stays NULL until earned.

INSERT INTO user_achievements (user_id, achievement_id, unlocked, unlocked_at)
SELECT
    p.id,
    a.id,
    false,
    NULL
FROM profiles p
CROSS JOIN achievements a;
