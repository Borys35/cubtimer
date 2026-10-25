# CubTimer

A fast, client-side speedcubing timer with strict progress analysis. Import [cstimer](https://cstimer.net/) sessions or time directly in the app — get a progress chart, a headline grade from 0–100, three sub-scores, and a coach that does not lie to you.

Everything runs in the browser. Signed out, your sessions are saved in this browser (localStorage). Sign in and they sync to the cloud (Supabase) across all your devices. No telemetry beyond page analytics.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit test suites
npm run build      # production build (fully static — Vercel-ready)
```

The app works without any configuration (browser-only mode). To turn on accounts and cloud sync, see [Accounts & cloud sync](#accounts--cloud-sync).

## Features

### Timer

- **Hold-to-start**: press and hold spacebar (or touch on mobile) for the configured delay before timing begins
- **Inspection mode**: optional WCA-style countdown. Hold and release to start the solve; starting up to 2s late adds +2, later is a DNF
- **Typing mode**: time on an external timer and type the result. Digits are formatted as you type (`1234` → `12.34`, `10245` → `1:02.45`), a trailing `+` adds +2, `DNF` records a DNF
- **Zen mode**: hides the session sidebar on the timer screen
- **Mobile-friendly**: touches on buttons or the scramble, swipes and two-finger touches never start the timer; any touch stops it
- **Blind mode**: hides the running time, shows "Solving..." — reveals the final time after solve ends
- **Phase colors**: red while holding (not ready), green when hold threshold met, default text otherwise
- **Scramble display**: large monospace scramble with wide letter spacing
- **Auto-hide sidebar**: sidebar collapses during solve for full focus, reappears after

### Sessions

- Create/delete/rename sessions per puzzle type (2x2–7x7, Pyraminx, Megaminx, Skewb, Square-1, Clock)
- Dropdown session picker sorted newest-first
- Session stats bar: best single, mean, median, std dev, rCV (MAD), IQR, and current/best ao5 / ao12
- Full solve list with +2 penalty, DNF, and delete actions
- Undo delete via toast notification

### Dashboard

Upload a cstimer export (.txt) → get a progress chart, scoring breakdown, and prescriptions.

- **Scoring model**: three sub-scores (improvement, consistency, frequency) weighted by skill level → headline grade
- **Chart**: one dot per session (size = solves, color = consistency) with a trend line and projection. Toggle a 5-session rolling average and solve volume on or off
- **Prescriptions**: drills from primary coaching sources, targeted at your weakest axis

### Settings

- Start delay (0–2000ms)
- Inspection mode toggle + duration
- Sound effects (start/stop beeps)
- Hide timer (blind mode)
- Input mode (built-in timer or typing) and zen mode, also toggled from the timer screen

### Accounts & sync

- **Sign in** with email and password from the navbar. Email-link (magic link) sign-in is built but marked "Soon" until custom SMTP is set up (`MAGIC_LINK_ENABLED` in `src/components/AccountMenu.tsx`)
- **Signed in**: sessions live in Supabase and sync between devices. A per-user copy is cached in the browser, so the app opens instantly and keeps working offline; changes queue up and upload when you're back online
- **Signed out**: everything is saved in this browser only
- **Local sessions on sign-in**: if this browser has sessions recorded while signed out, you're asked whether to add them to your account
- **Set password** from the account menu at any time
- **Installed app on iOS**: an app added to the home screen keeps its own storage, separate from Safari's, so solves you recorded signed out in Safari don't show up there. To bring them over, either sign in (in Safari and in the installed app) so they sync through your account, or export them from Safari (Settings → Export) and import the file in the installed app. The installed app shows a one-time hint about this when you open it signed out with no solves

### Themes

Dark → Light → Sticker. Sticker is the toy-box mode: cube-sticker-colored panels, rainbow wash. Preference persisted in localStorage.

## How your data is processed

1. **Parse** — sessions are read from the export JSON; each solve carries `[penaltyMs, timeMs, …splits], scramble, comment, timestamp`. Penalties (+2 s) are added to the raw time, DNFs excluded from all statistics, times floored to centiseconds like cstimer displays them.
2. **Type sessions** — puzzle type comes from scramble notation first (Square-1 `(n,m)` turns, wide moves for big cubes, short scrambles for 2x2, else 3x3), falling back to cstimer's `scrType` metadata.
3. **Merge & range-filter** — all sessions of the selected event merge into one chronological stream; the range selector (all/90/30/7 days) filters everything downstream.
4. **Score** — see below.

## The scoring model

Three sub-scores feed one headline number. Weights shift by your current level:

| Level  | Improvement | Consistency | Frequency |
| ------ | ----------- | ----------- | --------- |
| sub-60 | 45%         | 15%         | 40%       |
| sub-40 | 40%         | 25%         | 35%       |
| sub-25 | 35%         | 35%         | 30%       |
| sub-15 | 30%         | 40%         | 30%       |
| sub-10 | 25%         | 45%         | 30%       |

| Headline | Verdict  |
| -------- | -------- |
| ≥ 80     | good     |
| 60–79    | decent   |
| 40–59    | bad      |
| < 40     | horrible |

Consistency is scored on a robust median-based coefficient of variation (MAD-CV), so a single blow-up solve can't wreck the score.

Full scoring rationale in [`docs/research-scoring.md`](docs/research-scoring.md) and [`docs/research-prescriptions.md`](docs/research-prescriptions.md).

## Accounts & cloud sync

Cloud sync is optional; without these variables the app runs in browser-only mode and hides the sign-in button.

1. Create a Supabase project.
2. Apply the migrations in [`supabase/migrations/`](supabase/migrations) (`supabase db push`, or paste them into the SQL editor). They create `timer_sessions` and `timer_solves` with row level security: each user can only read and write their own rows.
3. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key (`sb_publishable_…`, never the secret key):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

4. In the Supabase dashboard, under Authentication → URL Configuration, allow your site URLs (e.g. `http://localhost:3000/**` and your production domain).

Before real users sign up:

- Set up custom SMTP. Supabase's built-in mailer only sends a few auth emails per hour, and account confirmation emails count against that.
- Turn on leaked password protection (Authentication settings).

How sync works: `src/lib/cloud-sync.ts` diffs each state change into upserts/deletes, which go through a persisted retry queue; `src/lib/cloud-adapter.ts` plugs that into the same storage interface the browser-only mode uses.

## Testing & CI

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit test suites
npm run build       # production build
npm run e2e         # Playwright: uploads fixtures/synthetic-export.txt, asserts dashboard health
npm run fixture     # regenerate the synthetic export (deterministic; expected stats travel with it)
```

### Pipeline (GitHub Actions)

Two jobs in `.github/workflows/ci.yml`:

1. **gate** — every push to `main` and every PR: typecheck, unit suites, build, E2E against a local build.
2. **smoke-prod** — pushes to `main` and a nightly cron: waits until the live site serves the matching commit, then runs the same flow against production.

## Limitations

- Improvement needs ≥ 4 distinct active days spanning ≥ 2 weeks in range.
- Consistency needs ≥ 10 clean solves in range.
