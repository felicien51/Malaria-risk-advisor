# Malaria Risk Advisor — Backend (Phase 2)

Flask + PostgreSQL API for the Malaria Risk Advisor. Replaces Phase 1's
direct browser-to-Open-Meteo call with a server that owns the weather
fetch, computes the risk score, and persists a per-user watchlist and
risk history behind authentication.

## Stack

Flask, Flask-SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Flask-CORS,
PostgreSQL (SQLite for local dev), Open-Meteo (external weather API).

## Setup

```bash
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt

cp .env.example .env            # then edit .env with real secrets
flask db upgrade                # creates tables
python wsgi.py                  # runs on http://localhost:5000
```

For local development without PostgreSQL installed, set in `.env`:
```
DATABASE_URL=sqlite:///dev.db
```
For production, point `DATABASE_URL` at a real PostgreSQL instance
(e.g. Render's managed Postgres).

## Data model

**User** — id, email (unique), password_hash, created_at.

**WatchedCounty** — id, user_id (FK → User), county_name, lat, lon,
created_at. One county per user (unique constraint on user_id +
county_name).

**RiskLog** — id, watched_county_id (FK → WatchedCounty), score, level,
rainfall, humidity, temp, recorded_at. A WatchedCounty has many RiskLog
entries — this is what powers the risk-history/trend view.

## Authentication

JWT-based, via Flask-JWT-Extended. Register or log in to receive a
token; send it as `Authorization: Bearer <token>` on every protected
request. Tokens expire after 7 days.

Every watchlist route is scoped to `get_jwt_identity()` — a user can
only ever see, edit, or delete their **own** records. Requests for
another user's `watched_county_id` return `404`, not `403`, so the
existence of another user's data is never leaked.

## API reference

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an account, returns a token |
| POST | `/api/auth/login` | — | Log in, returns a token |
| GET | `/api/auth/me` | required | Current user's profile |
| GET | `/api/counties/<name>/risk` | optional | Live risk for any county; logs to history if the caller has it watchlisted |
| GET | `/api/watchlist` | required | List the current user's watchlist |
| POST | `/api/watchlist` | required | Add a county (body: `{ "county_name": "Kisumu" }`) |
| PATCH | `/api/watchlist/<id>` | required | Change the county on a watchlist entry |
| DELETE | `/api/watchlist/<id>` | required | Remove a watchlist entry |
| GET | `/api/watchlist/<id>/history` | required | Full risk history for one watched county |
| GET | `/api/health` | — | Liveness check |

All error responses are JSON: `{"error": "..."}"`, with appropriate
HTTP status codes (400 validation, 401 unauthenticated, 404 not
found/not yours, 409 conflict, 502 weather service unreachable).

## Known limitation

Open-Meteo occasionally can't be reached from restricted network
environments (e.g. some sandboxed CI runners) — this is an upstream
network policy issue, not an application bug, and does not affect the
watchlist or auth functionality, which have no external dependency.
