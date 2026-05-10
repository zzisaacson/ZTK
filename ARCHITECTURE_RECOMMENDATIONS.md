# Guitar Learning App - Early Architecture Recommendations

This document recommends a practical starting stack for a cross-platform Expo app (web + iOS + Android), with room to grow into real-time lesson scoring.

## 1) Is Expo a good choice?

Short answer: yes, with one caveat.

- Expo is a strong choice for shared UI, auth flows, course/song browsing, achievements, payments, and most app features across web/mobile.
- For low-latency live pitch detection and scoring, you should expect to use **custom native modules / development builds** (not only Expo Go) for best performance.
- Recommended approach: keep 90% of app in Expo managed workflow, and use Expo Modules/custom native bridge for the audio analysis path.

## 2) Recommended backend stack (default)

## Option A (Recommended): Supabase + Postgres + Edge Functions

Why this is the best default for your product:

- Relational data model fits your domain well (`users`, `courses`, `songs`, `lessons`, `attempts`, `scores`, `leaderboards`, `achievements`).
- Strong auth support (email/password, OAuth, social) and straightforward Expo integration.
- Postgres gives durable analytics and flexible leaderboard queries.
- Row Level Security (RLS) is excellent for multi-tenant/user data safety.
- Realtime is useful for live events (session states, multiplayer/co-op later, live leaderboard updates).

Use Supabase for:

- Auth and profile/account records
- Course/song catalogs
- Attempt history and scoring summaries
- Achievements and leaderboard aggregates
- Storage (song assets, backing tracks, thumbnails)

Use Edge Functions for:

- Verifying score submissions server-side
- Running anti-cheat checks
- Payment webhooks and entitlement updates

## Option B: Firebase

Choose this if your team strongly prefers Firebase ecosystem and document data modeling.

- Excellent auth and realtime experience.
- More trade-offs for relational-heavy querying (leaderboards + analytics + reporting often become more complex).
- Native SDK integration with Expo usually means development builds.

## Option C: AWS Amplify + Cognito + AppSync/Lambda

Choose this if your team already has strong AWS experience and infra standards.

- Enterprise-ready and flexible.
- Higher initial complexity for a small team/startup.

## 3) Account management recommendations

Start simple:

- Provider: Supabase Auth (or Clerk/Auth0 if you want auth-as-a-service specialization).
- Sign-in: email + password first, then add Google/Apple.
- Session model: short-lived access tokens + refresh tokens.
- User model: keep auth identity separate from gameplay profile.

Suggested tables:

- `users` (app profile)
- `user_settings`
- `subscriptions`
- `course_enrollments`
- `song_attempts`
- `achievement_unlocks`
- `leaderboard_entries` (or materialized views)

## 4) Realtime lesson flow (frontend architecture)

For the "play song + detect pitch + score live" flow, split responsibilities:

1. **Transport/Timing Layer**
   - MIDI/chart parser and playback clock.
   - Metronome / tempo map handling.
   - Emits current beat/time cursor.

2. **Audio Capture + Pitch Layer**
   - Mic input stream.
   - Pitch extraction at small frame windows.
   - Noise gate + confidence threshold filtering.

3. **Scoring Layer**
   - Compare expected note window vs detected pitch/time.
   - Accuracy + timing score, combo logic.
   - Emit event stream for UI feedback.

4. **UI Layer**
   - Scrolling tablature/notes.
   - Hit/miss visualization.
   - Live score, streak, and post-song summary.

Keep scoring deterministic and mostly local during play; send signed summary/events to backend after each run for validation and persistence.

## 5) Frontend options to "bring in" early

These are the most useful Expo/React Native libraries and patterns for a polished frontend:

- `expo-router` for file-based navigation across web/mobile.
- `react-query` (TanStack Query) for API caching and offline-friendly UX.
- `react-hook-form` + `zod` for robust forms and validation.
- `react-native-reanimated` + `react-native-gesture-handler` for smooth, native-feeling motion.
- `shopify/flash-list` for high-performance song/course lists.
- `nativewind` or `tamagui` for fast, consistent design system styling.

For audio/pitch/MIDI specifically (prototype candidates):

- Pitch detection: `react-native-pitchy` or Expo-native DSP module path.
- MIDI/device APIs: `@motiz88/react-native-midi` (validate against your exact workflow).
- Audio engine/metronome: prefer native-timed engine over JS timers for accuracy.

## 6) Payment processor recommendation

Recommended:

- **Stripe** for subscriptions and one-time purchases.
- Mobile: use Stripe React Native SDK.
- Web: Stripe Elements/Checkout.
- Always finalize entitlements from backend webhook events (never trust client-only payment state).

## 7) Suggested phased implementation path

Phase 1 (Foundation):

- Expo app shell, navigation, auth, course/song catalog, profile.
- Backend schema and RLS.
- Basic progress tracking.

Phase 2 (Audio prototype):

- Single-song lesson player with metronome + scrolling chart.
- Basic pitch detection and local scoring loop.
- Save attempts to backend.

Phase 3 (Production scoring):

- Harden timing accuracy, anti-cheat checks, confidence thresholds.
- Leaderboards and achievements.
- Subscription/paywall integration.

## 8) Final recommendation

If you want a pragmatic and scalable start:

- **Frontend**: Expo + React Native + Reanimated + Query + design system (NativeWind/Tamagui).
- **Backend**: Supabase (Postgres/Auth/Storage/Realtime) + Edge Functions.
- **Payments**: Stripe + backend webhook entitlement sync.
- **Realtime scoring**: local/native-first lesson engine, then server-side validation + persistence.

This gives you fast iteration now, while still supporting the low-latency and competitive features you want later.
