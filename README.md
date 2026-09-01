# Malaria Risk Advisor

A full-stack application that estimates weather-driven malaria transmission
risk for any of Kenya's 47 counties. Users can check any county's risk
without an account, or register to save a personal watchlist and track how
risk changes over time.

**Live app:** https://malaria-risk-advisor.vercel.app
**Live API:** https://malaria-risk-advisor-api.onrender.com/api

Built in phases: a React frontend calling a public weather API directly
(Phase 1), then a Flask + PostgreSQL backend that took over the data layer,
added persistence, and added user accounts with ownership-based access
control (Phase 2).

---

## The problem

Malaria transmission risk rises and falls with weather: rainfall creates
standing water for mosquito breeding, humidity extends mosquito lifespan,
and warm temperatures speed up parasite development. A one-off risk check
is useful, but repeated manual re-checking with no memory of past results
is wasted effort — especially for anyone (a health worker, a family) who
tracks the same handful of counties regularly. This app turns that into a
persistent, per-user watchlist with real history instead of a blank slate
every visit.

---

## Architecture

```
React (Vite)  ──────▶  Flask API  ──────▶  PostgreSQL
  frontend/                app on Render      hosted on Render
                            │
                            ▼
                      Open-Meteo (external weather API)
```

The frontend never calls Open-Meteo directly — Flask owns that call,
computes the risk score server-side, and (for logged-in users who have a
county on their watchlist) logs the result so a real history builds up
over time.

---

## Repository structure

```
/
├── frontend/               React (Vite) app
│   ├── src/
│   │   ├── pages/              Home, Dashboard, Forecast, Compare,
│   │   │                       Watchlist, Profile, Login, Register, About
│   │   ├── components/         RiskGauge, ForecastChart, Layout,
│   │   │                       SettingsMenu, ProtectedRoute, ErrorBoundary
│   │   ├── context/            AuthContext, PreferencesContext, LanguageContext
│   │   ├── api/                 client.js — talks to the Flask backend
│   │   ├── hooks/               useWeatherData, useRecentCounties,
│   │   │                        useSessionRiskLog, useRiskNotifications
│   │   ├── utils/                riskScore.js, downloadCard.js
│   │   └── data/                 counties.js — 47 counties with coordinates
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json               SPA rewrite so client-side routes survive refresh
│   └── .env.example
│
├── backend/                 Flask + PostgreSQL API
│   ├── app/
│   │   ├── models.py             User, WatchedCounty, RiskLog
│   │   ├── routes/                auth.py, watchlist.py, risk.py, chat.py
│   │   ├── weather_service.py     Open-Meteo client + risk scoring
│   │   │                          (mirrors frontend/src/utils/riskScore.js)
│   │   ├── counties.py            same 47 counties, backend copy
│   │   ├── extensions.py
│   │   └── __init__.py            app factory
│   ├── migrations/                Flask-Migrate history
│   ├── config.py
│   ├── gunicorn.conf.py           single worker + raised timeout (see Deployment)
│   ├── wsgi.py
│   ├── requirements.txt
│   └── .env.example
│
└── README.md                 this file
```

---

## Setup

Both halves need to be running for the app to work locally. Start the
backend first.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env            # then edit with real secrets, see below
flask db upgrade                # creates/updates tables
python wsgi.py                  # runs on http://localhost:5000
```

`.env` values:

```
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_hex(32))">
JWT_SECRET_KEY=<generate a different one the same way>
DATABASE_URL=postgresql://localhost/malaria_risk_advisor
CORS_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# Optional — password reset emails via Brevo's HTTP API. Without these,
# forgot-password logs the reset link to the console instead of emailing
# it, which is fine for local dev.
BREVO_API_KEY=<from Brevo: SMTP & API > API Keys>
BREVO_SENDER_EMAIL=<a sender verified in Brevo>

# Optional — powers the in-app chat assistant (see Chat assistant below).
# Without this, /api/chat/message returns 503 rather than erroring, so
# the rest of the app works fine without it.
GEMINI_API_KEY=<free key from https://aistudio.google.com/apikey>
CHAT_MODEL=gemini-3.6-flash
```

No PostgreSQL installed locally? Use SQLite instead for development —
`DATABASE_URL=sqlite:///dev.db` — no other setup required. Production uses
real PostgreSQL (see Deployment below).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_URL, defaults to http://localhost:5000/api
npm run dev                     # runs on http://localhost:5173
```

---

## Authentication & ownership

JWT-based, via Flask-JWT-Extended, with a short-lived access token plus a
longer-lived refresh token. Registering or logging in returns both; the
frontend attaches the access token as `Authorization: Bearer <token>` on
every request that needs it. Checking a county's current risk doesn't
require an account — that stays open, matching Phase 1's behavior. Saving
a county to a personal watchlist does require one.

Every watchlist record belongs to exactly one user. The backend scopes
every read, update, and delete to the token's identity
(`get_jwt_identity()`), so a request for another user's data returns a
plain `404`, never a leaked "forbidden" that would confirm the record
exists.

Registration requires an **email**, a **username** (3–30 characters:
letters, numbers, underscores; must be unique, stored lowercase), and a
**password** (8+ characters, checked against a small common-password
blocklist so `password123`-style choices are rejected). The username is
what's shown in the app's nav instead of the email, and can be changed
later from the **Profile settings** page (`/profile`). Accounts created
before this field existed show their email as a fallback until they set
one.

**Access + refresh tokens.** Access tokens expire after 15 minutes —
short enough that a stolen one is only useful briefly. Rather than
forcing a re-login every 15 minutes, the frontend's API client (see
`frontend/src/api/client.js`) catches a `401` on an authenticated
request, silently exchanges the refresh token (30-day lifetime) for a
new access token via `POST /api/auth/refresh`, and retries the original
request once — the user never sees an interruption. Concurrent requests
that all hit a `401` around the same time share a single in-flight
refresh instead of each triggering their own. If the refresh token
itself is invalid or expired, the retry fails too and the user is signed
out normally.

**Token revocation.** Every access *and* refresh token embeds the user's
`token_version` as a claim; a server-side check on every authenticated
request rejects any token whose version doesn't match the user's current
one in the database. `set_password()` bumps this version automatically,
so completing a password reset invalidates every token issued before
it — both access and refresh, not just future logins — even though JWTs
are normally stateless and can't otherwise be revoked before they
expire. `POST /api/auth/logout-everywhere` bumps it on demand for an
explicit "log out on all devices" action (also available as a button on
the Profile settings page), without changing the password.

---

## Data model

**User** — id, email (unique), username (unique, nullable for
pre-existing accounts), password_hash, token_version (bumped on password
change or logout-everywhere; invalidates outstanding access and refresh
tokens alike — see Authentication above), created_at.

**WatchedCounty** — id, user_id (FK → User), county_name, lat, lon,
created_at. One row per user per county (unique constraint on the pair).

**RiskLog** — id, watched_county_id (FK → WatchedCounty), score, level,
rainfall, humidity, temp, recorded_at. A WatchedCounty has many RiskLog
entries — this is what powers the trend/history view.

---

## API reference

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account (email, username, password), returns an access + refresh token pair (rate-limited: 5/min) |
| POST | `/api/auth/login` | — | Log in, returns an access + refresh token pair (rate-limited: 5/min) |
| GET | `/api/auth/me` | required | Current user's profile |
| PATCH | `/api/auth/me` | required | Set/change username — powers the Profile settings page |
| POST | `/api/auth/refresh` | refresh token | Exchange a refresh token for a new access token (rate-limited: 30/min) |
| POST | `/api/auth/forgot-password` | — | Request a password reset email (rate-limited: 3/min) |
| POST | `/api/auth/reset-password` | — | Complete a password reset with the emailed token; invalidates all prior access *and* refresh tokens |
| POST | `/api/auth/logout-everywhere` | required | Invalidate every access and refresh token issued to this account |
| GET | `/api/counties/<name>/risk` | optional | Live risk for any county; logs to history if the caller has it watchlisted (rate-limited: 30/min) |
| GET | `/api/watchlist` | required | List the current user's watchlist |
| POST | `/api/watchlist` | required | Add a county — body: `{ "county_name": "Kisumu" }` |
| PATCH | `/api/watchlist/<id>` | required | Change the county on a watchlist entry |
| DELETE | `/api/watchlist/<id>` | required | Remove a watchlist entry |
| GET | `/api/watchlist/<id>/history` | required | Full risk history for one watched county |
| POST | `/api/chat/message` | optional | Ask the chat assistant a malaria risk/prevention question (rate-limited: 15/min) — see Chat assistant below |
| GET | `/api/health` | — | Liveness check |

All errors return JSON: `{"error": "..."}"`, with an appropriate status —
`400` validation, `401` unauthenticated, `404` not found/not yours, `409`
conflict (duplicate email/username/county), `502` weather service or chat
assistant unreachable, `503` chat assistant not configured (no
`GEMINI_API_KEY` set).

---

## Testing & CI

Backend: `pytest`, covering auth (register/login/duplicate handling,
access+refresh token issuance, the refresh endpoint correctly rejecting
an access token in place of a refresh token, and token revocation on
password reset and logout-everywhere covering both token types), the
chat endpoint (mocked Gemini responses — success, transient-failure
retry, permanent failure, history trimming), and risk-score computation —
including a regression test for a bug where forecast days were
incorrectly included in the trailing 14-day average (see
`backend/tests/test_risk_score.py`). 40 tests total.

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

GitHub Actions (`.github/workflows/ci.yml`) runs the backend test suite
and a frontend lint + build on every push and pull request to `main`.

---

## Risk-scoring logic

A transparent, weighted heuristic — not a clinical or diagnostic model:

| Factor | Weight | Basis |
|---|---|---|
| Rainfall (14-day total) | 40% | Standing water for larval breeding |
| Humidity (14-day average) | 30% | >60% extends adult mosquito lifespan |
| Temperature (14-day average) | 30% | 20–30°C speeds parasite development |

The same math exists in two places by design: `backend/app/weather_service.py`
computes it server-side (source of truth, what gets logged to history),
and `frontend/src/utils/riskScore.js` computes it client-side from the
same raw weather data the backend forwards — so a page can render
immediately without waiting on a second round trip. Both are hardened to
skip any day with missing/null values (Open-Meteo occasionally hasn't
finalized the most recent day or two).

---

## Chat assistant

A dedicated `/chat` page lets anyone ask a malaria risk/prevention
question, optionally scoped to a specific county — if one is selected,
the backend fetches that county's live weather/risk data (the same call
`weather_service.py` makes for the dashboard) and passes it to the model
as context, so an answer like "why is my risk moderate?" lines up with
what's on screen.

**Model:** Google's Gemini (`CHAT_MODEL`, default `gemini-3.6-flash`),
called via a plain REST `POST` (`app/routes/chat.py`) rather than the
`google-genai` SDK. The SDK pulls in `grpc`/`pydantic`/`httpx`/
`websockets`, which pushed the app's memory footprint over Render's
free-tier 512MB limit and got the worker OOM-killed; `requests` is
already a dependency (used for weather data), so calling the REST
endpoint directly adds no extra memory cost.

**Reliability:** one automatic retry with backoff on a transient failure
(a 503 "currently experiencing high demand" from Gemini's free tier, or a
slow response that times out), since both usually clear within a couple
of seconds. `gunicorn.conf.py` raises the worker timeout (and pins to a
single worker/multi-thread process) so a slower Gemini response — or the
retry itself — doesn't get killed mid-request.

**Scope and safety:** the system prompt keeps answers limited to
malaria risk/prevention topics, explicitly defers medical
diagnosis/treatment questions to a healthcare provider, and asks for
plain text (no markdown) to match the chat bubble's rendering. The
endpoint works for anonymous visitors — no account required, matching the
rest of the app's "check without logging in" philosophy — and is
rate-limited (15/min) since each call has a real cost.

---

## Features

- Search or browse all 47 counties; no account required to check risk
- Register / log in with a username; per-user saved watchlist with full
  CRUD (add, rename/swap the county, remove)
- Risk history per watched county, persisted server-side
- 16-day forecast, 7/16-day toggle
- County comparison view (up to 3 side by side)
- Downloadable risk-summary card (PNG)
- Optional browser notifications for high-risk alerts
- Dark/light theme, metric/imperial units, English/Swahili — consolidated
  into a single settings menu, all persisted locally
- Loading, error (with retry), and empty states throughout; an error
  boundary catches any unexpected render failure instead of a blank page
- Forgot/reset password flow, emailed via Brevo's HTTP API (chosen over
  SMTP because Render's free tier blocks outbound SMTP ports)
- Password reset and an explicit "log out everywhere" both invalidate
  every previously issued access *and* refresh token, not just future
  logins
- Short-lived (15 min) access tokens with a 30-day refresh token behind
  the scenes; the API client silently renews an expired access token and
  retries, so a session just keeps working without an interruption
- Profile settings page (`/profile`) — change your username, see your
  email, log out on all devices
- AI chat assistant (Google Gemini) for malaria risk/prevention
  questions, optionally grounded in a specific county's live risk data —
  no account required

---

## Deployment

- **Frontend:** Vercel, root directory set to `frontend`. `VITE_API_URL`
  set as an environment variable pointing at the deployed backend.
  `vercel.json` rewrites all routes to `index.html` so client-side routes
  (e.g. `/county/Kisumu`) survive a direct refresh instead of hitting
  Vercel's own 404.
- **Backend:** Render, root directory set to `backend`. Build command runs
  `pip install -r requirements.txt && flask db upgrade`, so every deploy
  migrates the database automatically. Connected to a Render-managed
  PostgreSQL instance via `DATABASE_URL`. `gunicorn.conf.py` pins a single
  worker with a raised timeout — Render's free tier gives ~512MB RAM, and
  the default worker timeout (30s) was too short for a slower chat
  response; both are read automatically by gunicorn without needing
  anything in Render's Start Command field. `GEMINI_API_KEY` (and
  optionally `CHAT_MODEL`) must be set as an environment variable on
  Render for the chat assistant to work in production.

---

## Known limitations

- The risk-scoring thresholds are a simplified educational heuristic, not
  a clinical or epidemiological model — see the in-app Methodology page
- County coordinates point to each county's main town, not a precise
  centroid
- Auth tokens (both access and refresh) are stored in `localStorage`, not
  an httpOnly cookie — an XSS vulnerability could expose either. Accepted
  tradeoff for this project; an httpOnly-cookie approach would need CSRF
  protection in exchange
- Open-Meteo may rate-limit requests from Render's free-tier shared IP
  addresses more aggressively than from a residential IP — an
  infrastructure characteristic of free hosting, not an application bug
- Browser notifications only fire while the tab is open (no push server)
- Swahili translation covers navigation and key headings, not every
  dynamic string
- Risk-history entries (`RiskLog`) are capped at one per watched county
  per calendar day, so refreshing a dashboard repeatedly won't flood the
  trend view — but this also means the very first check of a new day
  always wins, even if conditions change later that day
- No TypeScript/PropTypes — prop mismatches are caught at runtime (or not
  at all) rather than at build time
- The chat assistant depends on Gemini's free tier, which occasionally
  returns a transient "high demand" error under load; one retry is built
  in, but a second consecutive failure still surfaces to the user
- Render's free-tier instance spins down after inactivity, so the first
  request after a period of idle time (chat or otherwise) can take 30–60
  seconds to wake up

---

## Roadmap

Authentication landed in Phase 2 (moved up from the original Phase 3 plan
to match the actual assignment requirements). Rate limiting, a
forgot/reset password flow, a backend test suite with CI, token
revocation on password reset/logout-everywhere, an AI chat assistant,
short-lived access tokens backed by refresh tokens, and a profile
settings page have since landed too. Remaining ideas: pagination on the
watchlist/history endpoints, streaming chat responses instead of waiting
for the full reply, refresh token rotation with theft detection (current
refresh tokens are long-lived and revoked only in bulk via
`logout-everywhere`, not individually), and a TypeScript migration for
the frontend.
