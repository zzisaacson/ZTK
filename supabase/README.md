# Zero To Kumziz — Supabase Backend

## Directory layout

```
supabase/
  config.toml                   Local dev configuration
  seed.sql                      Static catalog + seeded user data
  migrations/
    001_initial_schema.sql      Full schema, ENUMs, indexes, and RLS policies
```

---

## 1. Install Supabase CLI

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Verify
supabase --version
```

Requires Docker Desktop running locally for the local dev stack.

---

## 2. Initialise the project (first time only)

Run this from the repo root (`/Users/alecdron/Documents/GitHub/ZTK`):

```bash
supabase init
```

This writes `supabase/config.toml` — the file is already committed, so the CLI
will detect it and skip re-initialisation. If prompted, confirm you want to use
the existing config.

---

## 3. Start the local stack

```bash
supabase start
```

This spins up Postgres, PostgREST, Auth, Studio, and Inbucket via Docker.
On first run it pulls images (a few minutes). Subsequent starts are fast.

The CLI prints your local credentials when ready:

```
API URL:      http://localhost:54321
DB URL:       postgresql://postgres:postgres@localhost:54322/postgres
Studio URL:   http://localhost:54323
Anon key:     <local-anon-key>
Service role: <local-service-role-key>
```

---

## 4. Apply migrations and seed data

```bash
supabase db reset
```

This command:
1. Drops and recreates the local database.
2. Applies every file in `supabase/migrations/` in filename order.
3. Runs `supabase/seed.sql`.

Run `supabase db reset` any time you change a migration or the seed file.

---

## 5. Create the two Auth users and fix the seed UUIDs

The seed file inserts profiles with **placeholder UUIDs** because Supabase Auth
owns user creation — you cannot freely choose UUIDs outside of Auth.

### Option A — Supabase Dashboard (local Studio)

1. Open http://localhost:54323 → Authentication → Users → Add user.
2. Create `alecdron@gmail.com` and `zachisaacson@gmail.com` (set a temporary password).
3. Copy the UUID Supabase assigns to each user.
4. Open `supabase/seed.sql` and replace the two placeholder UUIDs:
   - `00000000-0000-0000-0000-000000000001` → Alec's real UUID
   - `00000000-0000-0000-0000-000000000002` → Zach's real UUID
5. Re-run `supabase db reset`.

### Option B — Supabase CLI (remote project)

```bash
# Install the management API token first: supabase login
supabase --project-ref <your-project-ref> users create \
    --email alecdron@gmail.com --password '<tmp-password>'

supabase --project-ref <your-project-ref> users create \
    --email zachisaacson@gmail.com --password '<tmp-password>'
```

Then follow the same UUID-replacement steps above and push the seed manually
(see section 7).

---

## 6. Connect the Expo app

Create a `.env.local` file in the repo root (never commit this file):

```env
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key printed by supabase start>
```

For the hosted Supabase project, use the values from the Supabase Dashboard →
Project Settings → API:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<project-anon-key>
```

Expo picks up `EXPO_PUBLIC_*` variables automatically in both Metro (native) and
the web bundler. Read them in your service layer:

```ts
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

---

## 7. Push to a hosted Supabase project (production / staging)

```bash
# Link once
supabase link --project-ref <your-project-ref>

# Push all pending migrations
supabase db push

# Run seed manually (db push does NOT run seed.sql on remote)
psql "<your-project-db-url>" -f supabase/seed.sql
```

Get `<your-project-db-url>` from: Dashboard → Project Settings → Database →
Connection string (URI mode, port 5432).

---

## 8. Schema overview

| Table | Purpose |
|---|---|
| `profiles` | One row per Auth user. Stores display name, avatar emoji, streak, session count, admin flag. |
| `modules` | Static catalog of all 20 learning modules. Never changes at runtime. |
| `user_module_progress` | Per-user star ratings (1–3) for each completed module. |
| `achievements` | Static catalog of all 8 achievement definitions. |
| `user_achievements` | Per-user achievement state. Pre-seeded as locked; app flips `unlocked = true`. |
| `friendships` | Directed friend requests with pending / accepted / declined status. |
| `messages` | Admin-to-user inbox. Only rows where `sender.is_admin = true` can be inserted (enforced by RLS). |

Row-Level Security is enabled on all tables. Each user can only read and write
their own data. Catalog tables (`modules`, `achievements`) are readable by any
authenticated user but not writable via the API.

---

## 9. Install the Supabase JS client in the Expo app

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
```

Minimal client setup (`src/services/supabase.ts`):

```ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // required for React Native
    },
  }
);
```

`detectSessionInUrl: false` is mandatory on React Native — the library otherwise
tries to read `window.location` which does not exist outside of a web context.
