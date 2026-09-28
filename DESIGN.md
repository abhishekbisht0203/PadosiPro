# DESIGN.md — PadosiPro take-home assignment

One page on how it is put together, what I traded away, and what I would do with
another week.

---

## Architecture

Two deployable pieces, plus the database.

```
┌──────────────────────────────┐        ┌────────────────────────────────┐
│  mobile/  Expo + RN 0.86     │        │  backend/  Node 22 · TS        │
│                              │        │                                │
│  AuthContext                 │  HTTPS │  app.ts ─ routes ─ services    │
│   stage: welcome│verify│     │ ─────► │       │                         │
│           profile│tasks│home │  JWT   │       ├─ auth      (OTP, login)  │
│                              │        │       ├─ profile   (details)    │
│  screens/  6 screens         │        │       └─ tasks     (catalogue)  │
│  components/ animated kit    │        │                                │
│  api/  client · types · err  │        │  lib/otp.ts — pure, tested     │
│  theme/  tokens from the site│        │  zod  ·  bcrypt  ·  JWT        │
└──────────────────────────────┘        └───────────────┬────────────────┘
                                                      │
                                          ┌───────────▼────────────┐
                                          │  PostgreSQL (Neon /    │
                                          │  Docker / local)      │
                                          └────────────────────────┘
```

**Backend.** Express with a thin HTTP layer. Each module is `routes.ts` (parse,
authorise, shape the response) over `service.ts` (the rules) over `pg` (the data).
Validation is zod at the boundary; every failure is one `AppError` with a stable
`code`, so the client switches on codes rather than parsing English. SQL is
hand-written — the schema is small enough to read in one sitting during the
final round, and there is no ORM to learn.

The OTP rules live in `lib/otp.ts`, which has no database and no network, so
expiry, the attempt limit, single use and the resend cooldown are unit tested as
a state machine rather than through HTTP.

**Mobile.** A single `AuthContext` owns the journey as one `stage` value
(`welcome │ verify │ profile │ tasks │ home`) derived from token + profile +
selection count. `RootNavigator` maps that to a screen. One cold-start call to
`GET /api/auth/me` decides where a returning user lands, which is what makes
"stays logged in after restarting" fall out for free rather than being
special-cased. Design tokens were read off the real app's stylesheet — primary
`#155C49`, canvas `#FAFAF7`, accent `#C9A84C`, the same Feather icon set — so it
reads as the same product.

---

## The main trade-offs

**Declarative routing instead of a navigation stack.** React Navigation is
installed, but the funnel is rendered from `stage`. The journey is one-way, and
the failure mode of a back stack here — a back gesture into a screen whose
preconditions no longer hold — is exactly the bug that costs a user their data.
The cost is losing transitions and deep links. The first thing I'd add is a real
stack for the one place it earns its keep: Home → Edit tasks.

**Replace the selection rather than toggle it.** `PUT /api/tasks/selected` takes
the whole list. Toggling per item would need conflict handling for two devices;
replacement makes the server authoritative and the client dumb. The trade-off is
a heavier write on every confirm, which does not matter at this size.

**`bcryptjs` over native `bcrypt`/`argon2`.** Pure JS, so no `node-gyp` step on a
reviewer's machine and it works identically on Alpine, macOS and Windows. The
brief allows either. I would switch to `argon2id` for production — it is
faster and stronger — and accept the native build then, because by then the
build pipeline is worth having.

**One catalogue query, groups assembled in TypeScript.** `GET /api/tasks`
returns categories and tasks in one round trip, and the app groups them itself.
With a handful of categories that is right; at a few thousand tasks it would want
to be SQL-side grouping plus server-side search.

**Register on an unverified email re-sends rather than 409s.** Friendlier, and it
leaks nothing an attacker did not already have. Once the address is verified it
becomes a hard 409.

**Client and server both validate.** Deliberate duplication. The client copy is
for immediate feedback without a round trip; the server is the authority, and its
`details` map wins when the two disagree. Both sets of rules are tested.

---

## What I left out

- **Refresh tokens / "log out everywhere".** Logout clears the token on the
  device, which satisfies the brief, but the token stays valid until it expires.
- **Server-side revocation.** A `token_version` column on `users`, bumped on
  logout, is the cheapest version of this and is ~20 lines.
- **Push notifications** for "your Lifestyle Manager is on the way".
- **Localisation.** The app is English-only; the copy is already centralised
  enough that adding strings is mostly mechanical.
- **E2E tests in the app.** The journey is covered end to end by the API
  integration suite and by `npm run smoke`, which walks a real server over
  HTTP. Detox/Maestro would add confidence on the UI side specifically.
- **iOS build.** Android is what I could actually verify here.

---

## With another week, in order

1. **Revocable sessions.** `token_version` on `users`, a refresh-token table, and
   a device list in settings. This is the real gap in the auth story.
2. **E2E tests in the app** with Maestro — one spec per screen transition. The
   flows are stable enough to automate now.
3. **Edit tasks as a real route** off Home, with unsaved-changes protection, so
   the navigation stack earns its place.
4. **Push notifications** plus a notifications screen, which is where the product
   starts to feel like it is doing work for the user rather than only recording
   what they asked for.
5. **Argon2id** for password hashing, and a `docker-compose` profile so the
   choice is visible and reversible.
6. **Rate limiting in Redis** rather than in-process memory, so limits are shared
   across instances once there is more than one.
7. **A seeded demo account** and a `?demo=1` mode, so a reviewer can reach Home
   in two taps without waiting on email.

---

## Things I would flag in the final round

- The integration suite truncates its own tables, so it refuses to run against a
  remote database without an explicit `ALLOW_TEST_DB_RESET=true`. That guard is
  deliberate; it is the kind of thing that is easy to forget and expensive when
  it goes wrong.
- Two bugs came out of running the thing rather than reading it: an invalid
  CORS header pair that broke every browser client, and a trailing space in an
  environment variable that produced a misleading network error. Both are fixed
  and both now have regression tests. They are written up in README §9.
- `lib/otp.ts` takes an injectable `matches` function purely so the state
  machine can be tested without paying bcrypt's cost twenty times. Production
  passes the real one. If someone wonders why the signature is shaped that way,
  that is the answer.
