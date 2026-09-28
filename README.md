# PadosiPro — Full-Stack Developer Take-Home Assignment

A native React Native (Expo) customer app and the Node/TypeScript API behind it,
covering the first real PadosiPro journey: **register → verify your email →
sign in → tell us about you → pick your tasks → home**.

The visual language is modelled on `app.padosipro.com` (deep green primary, warm
off-white canvas, gold accent, generous radii, Feather icons). Every screen is
built natively — there is no WebView and no asset was copied from their site.

```
.
├── backend/          Node 20+ · TypeScript · Express · PostgreSQL · zod · vitest
├── mobile/           Expo SDK 57 · React Native 0.86 · TypeScript · Reanimated
├── docker-compose.yml
├── README.md
└── DESIGN.md
```

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 or newer | 22 LTS recommended (matches the Docker image) |
| npm | 10+ | ships with Node |
| Docker Desktop | any recent | **only** for the one-command path in §2 |
| Android Studio | Ladybug+ | optional, for the Android emulator |
| Xcode | 15+ | optional, macOS only, for the iOS simulator |

You do **not** need a local PostgreSQL install. Docker Compose provides one.

---

## 2. Run the backend — one command

```bash
git clone <this-repo> padosipro-assignment
cd padosipro-assignment
docker compose up --build
```

That single command starts three services:

| Service | URL | What it is |
|---|---|---|
| **API** | http://localhost:4000 | The backend. Migrations and catalogue seed run automatically at boot. |
| **Mailpit** | http://localhost:8025 | Catches every email the API sends, including your OTP. |
| PostgreSQL | `localhost:5432` | `padosipro` / `padosipro` / database `padosipro`. |

Check it is up:

```bash
curl http://localhost:4000/health
# {"status":"ok","service":"padosipro-api","time":"..."}

curl http://localhost:4000/api/meta
# {"data":{"categories":15,"tasks":102,"otp":{"length":6,"ttlMinutes":10}}}
```

### Without Docker

If you already have PostgreSQL, or you want to point at a hosted one:

```bash
cd backend
npm install
cp .env.example .env          # then edit DATABASE_URL
npm run migrate && npm run seed
npm run dev
```

`npm run migrate` and `npm run seed` are already run automatically by `npm run dev`,
so for a fresh database you can just do `npm install && npm run dev`.

---

## 3. Run the app

```bash
cd mobile
npm install
npx expo start
```

Then press **`a`** for an Android emulator, **`i`** for an iOS simulator, or scan
the QR code with Expo Go.

### Pointing the app at your backend

The app resolves the API URL in this order:

1. `EXPO_PUBLIC_API_URL`, if set
2. `http://10.0.2.2:4000` on Android (how the emulator reaches your machine)
3. your LAN IP on iOS Simulator / Expo Go
4. `http://localhost:4000`

If the API is not on the same machine, set it explicitly:

```bash
# PowerShell
$env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:4000"; npx expo start

# macOS / Linux
EXPO_PUBLIC_API_URL="http://192.168.1.20:4000" npx expo start
```

> **Gotcha worth knowing:** in `cmd.exe`, `set VAR=value && npx …` puts the
> space before `&&` **into** the value. Quote it — `set "VAR=value" && npx …` — or
> the app will report a misleading "Cannot reach the server". The app now trims
> and validates this URL at startup and tells you what is wrong with it, but
> quoting is still the right fix.

> **If Metro says `Cannot find module 'babel-preset-expo'`**, run
> `npx expo start --clear`. That is a stale bundler cache, not a missing package.

---

## 4. Walking the flow

1. **Register** — email + password + confirm, with inline validation.
2. **Verify** — a 6-digit code arrives by email. With the Docker stack, open
   <http://localhost:8025> and read it. Without Docker it is printed to the API
   console in a `CODE: 123456` box. The app shows a resend countdown and an
   expiry countdown, and verifies automatically once all six digits are entered.
3. **Sign in** — the app stays signed in across restarts (token in
   `AsyncStorage`, revalidated with `GET /api/auth/me` on cold start).
4. **Profile** — shown once, straight after the first successful login.
5. **Tasks** — 15 categories, 102 tasks, search, multi-select, per-category
   "All", and a sticky bar showing the running count.
6. **Home** — your tasks grouped by category, your saved details, edit and log out.

To re-run the flow from scratch, press **Edit** on Home to clear the selection
(you will be routed back to task selection), or **Log out** and register again.

---

## 5. Build an APK

Requires Android Studio with the Android SDK, and a JDK 17.

```bash
cd mobile

# 1. Generate the native Android project (creates ./android)
npx expo prebuild --platform android

# 2. Build a release APK
cd android
./gradlew assembleRelease
```

The APK lands at:

```
mobile/android/app/build/outputs/apk/release/app-release.apk
```

Install it on a device with `adb install -r <path>/app-release.apk`.

For a Play Store bundle use `./gradlew bundleRelease` instead.

**Notes**

- `prebuild` runs `expo prebuild`, which needs network access on first run to
  fetch Gradle and the Android SDK bits.
- The release build is signed with the Expo **debug** keystore by default, which
  is fine for a review build but not for the Play Store. Add a `credentials.json`
  and the `expo-build-properties` plugin for a real signing key.
- EAS is the shorter path if you have an Expo account:
  `npx eas build --platform android --profile preview`, which emails you a link
  to the APK.

**iOS** is the same shape (`npx expo prebuild --platform ios && pod install`,
then build in Xcode), but needs macOS and a paid Apple Developer account for a
device build. The brief says Android alone is fine, so Android is what I verified.

---

## 6. Tests

```bash
cd backend
npm test
```

74 tests across 5 files. They cover the risky parts the brief calls out plus
what actually broke during development:

| File | Covers |
|---|---|
| `src/tests/otp.test.ts` | OTP generation and digit bias, hashing, expiry at the exact boundary, the 5-attempt limit, single use, the 30s resend cooldown |
| `src/tests/validation.test.ts` | Email and password rules, Indian mobile normalisation (`9876543210`, `+91 98765 43210`, `091-98765-43210`), optional business name |
| `src/tests/rateLimit.test.ts` | That credential endpoints are actually rate limited |
| `src/tests/cors.test.ts` | That the API never sends the invalid wildcard + credentials pair (regression — see §9) |
| `src/tests/api.test.ts` | The whole journey over HTTP: register, verify, wrong code, lockout, resend cooldown, login rules, profile, task selection, auth guards |

The integration tests need a database. They use `TEST_DATABASE_URL`, then
`DATABASE_URL`, then a local default. **They truncate `users`, `profiles`,
`email_otps` and `user_tasks`**, so the suite refuses to run against a remote
database unless you opt in:

```bash
ALLOW_TEST_DB_RESET=true npm test
```

### If you have no database at all

```bash
npm run test:embedded
```

This downloads a throwaway PostgreSQL into your temp folder, runs the whole
suite against it, and deletes it afterwards.

### End-to-end smoke test against a real server

```bash
npm run smoke
```

Boots Postgres and the real API, then walks register → verify → login → profile
→ task selection → logout over HTTP, asserting 40 properties (including that the
catalogue has ≥ 20 tasks in ≥ 4 categories). Useful as a single "is it all
wired up?" check.

### Type checks and app health

```bash
cd backend && npm run typecheck
cd mobile  && npm run typecheck && npx expo-doctor
```

---

## 7. Environment variables

`backend/.env.example` is the full list; copy it to `.env`. `.env` is
gitignored and no real secret is committed.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Required. `sslmode=require` (or a managed host) turns TLS on automatically. |
| `DATABASE_SSL` | auto | `true`/`false` to force certificate verification on or off. On by default when TLS is used. |
| `JWT_SECRET` | — | Required, ≥ 16 chars. The server **refuses to boot in production** with the example value. |
| `JWT_EXPIRES_IN` | `7d` | |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost. |
| `OTP_BCRYPT_ROUNDS` | `10` | OTP hashing cost. |
| `OTP_LENGTH` | `6` | |
| `OTP_TTL_MINUTES` | `10` | |
| `OTP_MAX_ATTEMPTS` | `5` | |
| `OTP_RESEND_COOLDOWN_SECONDS` | `30` | |
| `MAIL_MODE` | `smtp` | `smtp` uses `SMTP_*`; `console` prints the OTP to stdout. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | `localhost` / `1025` | Mailpit in Docker; SES/SendGrid/Gmail in production. |
| `MAIL_FROM` | `PadosiPro <no-reply@padosipro.local>` | |
| `CORS_ORIGIN` | `*` | Comma-separated allow-list in production. `*` reflects the caller's origin rather than sending a wildcard (see §9). |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | |
| `REGISTER_RATE_LIMIT_PER_15MIN` | `10` | |

The app has one: `EXPO_PUBLIC_API_URL` (§3).

---

## 8. Email delivery

The brief asks which transport is used, so, explicitly:

- **Locally with Docker: Mailpit.** `docker compose up` starts it on
  <http://localhost:8025>; `SMTP_HOST=mailpit`, `SMTP_PORT=1025`. Nothing leaves
  your machine.
- **Locally without Docker: the console.** `MAIL_MODE=console` skips SMTP and
  prints the code to the API's stdout. Useful, and it is how the automated
  tests get a code.
- **In production: any SMTP provider** (Amazon SES, SendGrid, Postmark, Gmail).
  Swap the `SMTP_*` values; the template lives in `backend/src/lib/mailer.ts`.

---

## 9. Two bugs this build caught, and how

Worth reading, because both were found by actually running things rather than by
reading code.

**CORS invalid header pair.** `cors({ origin: '*', credentials: true })` makes the
middleware send `Access-Control-Allow-Origin: *` *and*
`Access-Control-Allow-Credentials: true`. Browsers reject that combination
outright, so every cross-origin request failed as a network error while the API
was returning perfectly good responses. Fixed in `backend/src/app.ts` by
reflecting the caller's origin instead of emitting a wildcard, with
`src/tests/cors.test.ts` pinning the invariant.

**A trailing space in `EXPO_PUBLIC_API_URL`.** `set VAR=value && npx expo start`
in `cmd.exe` keeps the space before `&&` in the value. The app then requested
`http://localhost:4000 /api/auth/register` — an invalid URL — and reported
"Cannot reach the server", which sent me looking at the wrong end entirely. The
client now trims and validates the URL at startup and throws a message naming the
variable and the mistake.

---

## 10. Decisions the brief left open

- **Business name is optional.** A large share of PadosiPro users are households
  rather than businesses, and forcing a business name adds friction to a flow we
  want to be fast. The field is present, clearly labelled "(optional)", and
  accepted whenever supplied.
- **Password policy** is ≥ 8 characters with upper case, lower case and a digit,
  capped at 72 characters because bcrypt silently truncates beyond that — two
  different passwords must never be equivalent.
- **Mobile numbers** are stored as a bare 10-digit string. `+91 98765 43210`,
  `091-98765-43210` and `9876543210` all normalise to the same value, in the app
  and on the server.
- **Registering an already-registered, unverified email** re-sends a code and
  returns `201` rather than an error. It is the friendlier behaviour and leaks
  nothing an attacker did not already have (the address). Once verified, it is a
  `409` and the app points the user at sign-in.
- **"Confirm selection" is inline**, in a sticky bar rather than a second screen,
  so the count and the action stay visible while scrolling and there is no way to
  be stranded.

---

## 11. API reference

All responses are `{ "data": … }` or `{ "error": { code, message, details?, meta? } }`.
`code` is stable and is what the app switches on.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | — | Liveness. |
| `GET` | `/api/meta` | — | Catalogue size and OTP policy. |
| `POST` | `/api/auth/register` | — | Create account, email a code. |
| `POST` | `/api/auth/verify-otp` | — | Exchange `{ email, code }` for a token. |
| `POST` | `/api/auth/resend-otp` | — | Re-send, honouring the cooldown. |
| `POST` | `/api/auth/login` | — | Verified accounts only. |
| `GET` | `/api/auth/me` | ✅ | Current user, profile and selection count. Drives cold start. |
| `GET` | `/api/profile` | ✅ | Read the profile. |
| `PUT` | `/api/profile` | ✅ | Create or update. |
| `DELETE` | `/api/profile` | ✅ | Clear it. |
| `GET` | `/api/tasks` | ✅ | Catalogue grouped by category, with `selected` per task. |
| `GET` | `/api/tasks/selected` | ✅ | The user's selection. |
| `PUT` | `/api/tasks/selected` | ✅ | Replace the selection with `{ taskIds: number[] }`. |

### Error codes

`VALIDATION_ERROR` · `INVALID_JSON` · `AUTH_REQUIRED` · `TOKEN_INVALID` ·
`TOKEN_EXPIRED` · `INVALID_CREDENTIALS` · `EMAIL_NOT_VERIFIED` ·
`EMAIL_ALREADY_REGISTERED` · `EMAIL_ALREADY_VERIFIED` · `ACCOUNT_NOT_FOUND` ·
`OTP_INVALID` · `OTP_EXPIRED` · `OTP_LOCKED` · `OTP_ALREADY_USED` ·
`OTP_RESEND_TOO_SOON` · `UNKNOWN_TASKS` · `RATE_LIMITED` · `CONFLICT` ·
`ROUTE_NOT_FOUND` · `INTERNAL_ERROR`

### Example

```bash
# Register — the OTP is printed to the console / Mailpit
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"Str0ngPass!"}'

# Verify
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","code":"123456"}'
# → {"data":{"token":"eyJ…","user":{…}}}

# Everything else needs the token
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer eyJ…"
```

---

## 12. Security notes

- Passwords are hashed with **bcrypt** (cost 12). The plaintext is never logged
  or stored. `bcryptjs` is used rather than native `bcrypt` so there is no
  `node-gyp` step to break on a reviewer's machine.
- OTP codes are generated with **`crypto.randomInt`**, which rejects out-of-range
  values — `Math.random() % 10⁶` would bias the leading digits — and only a
  **bcrypt hash** is persisted. A test samples 20 000 codes to prove the
  distribution is not skewed.
- A wrong OTP costs an attempt, **including a malformed one**, so "not a number"
  is not a free oracle for guessing.
- Issuing a new code consumes any previous outstanding one, so an older emailed
  code can never be used.
- Login returns one message for "no such account" and "wrong password", and
  still runs a bcrypt comparison against a dummy hash when the account is
  missing, so the two are not distinguishable by timing.
- Credential endpoints are rate limited per IP (20/minute, 10 sign-ups per 15).
- Tokens are 7-day HS256 JWTs, sent as `Authorization: Bearer`.
- **Logout is client-side**: the app discards the token. Server-side revocation
  is called out in `DESIGN.md` as the next step, since it needs a token-version
  column or a denylist.
- The OTP plaintext is only ever in the API's memory and the SMTP conversation.
  The one exception is an in-memory outbox that exists **only** when
  `NODE_ENV=test`, which is how the integration tests stand in for a user
  reading their inbox.

---

## 13. What I did not build

Called out honestly in `DESIGN.md`: refresh tokens, server-side logout
revocation, push notifications, i18n, and E2E tests in the app (the journey is
covered by the API integration suite and a `npm run smoke` walk instead).
