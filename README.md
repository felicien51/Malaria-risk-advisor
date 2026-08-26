# Malaria Risk Advisor

A full-stack application that estimates weather-driven malaria transmission
risk for any of Kenya's 47 counties, lets users create an account, save a
personal watchlist of counties, and track how risk changes over time.

Built in three phases: a React frontend calling a public weather API
directly (Phase 1), a Flask + PostgreSQL backend that took over the data
layer and added persistence (Phase 2), and authentication is part of Phase
2 as well — ownership-based access control on every saved record.

**Live demo:** https://malaria-risk-advisor.vercel.app/ (frontend) —
backend deployment link added once live.

## Problem

Malaria transmission risk rises and falls with weather: rainfall creates
standing water for mosquito breeding, humidity extends mosquito lifespan,
and warm temperatures speed up parasite development. Phase 1 let anyone
check a county's current risk, but had no memory — every visit meant
re-searching the same counties with no record of how risk had changed.
Phase 2 fixes that with real accounts and a persistent, per-user watchlist
and history.

## Architecture

```
React (Vite)  →  Flask API  →  PostgreSQL
                      ↓
                 Open-Meteo (external weather data)
```

The frontend never calls Open-Meteo directly anymore — the Flask backend
owns that call, computes the risk score server-side, and (for logged-in
users with a county on their watchlist) logs the result to build a real
history.

## Repository structure

```
/               React frontend (Vite)
  src/
    pages/          Home, Dashboard, Forecast, Compare, Watchlist, Login, Register, About
    components/     RiskGauge, ForecastChart, Layout, ProtectedRoute, ErrorBoundary
    context/        AuthContext, PreferencesContext, LanguageContext
    api/            client.js — talks to the Flask backend
    hooks/          useWeatherData, useRecentCounties, useSessionRiskLog, useRiskNotifications
    utils/          riskScore.js, downloadCard.js
    data/           counties.js — 47 counties with coordinates

/backend        Flask + PostgreSQL API
  app/
    models.py       User, WatchedCounty, RiskLog
    routes/         auth.py, watchlist.py, risk.py
    weather_service.py   Open-Meteo client + risk scoring (mirrors src/utils/riskScore.js)
  migrations/     Flask-Migrate history
  README.md       Full backend setup + API reference
```

## Setup

### Backend (start this first)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # then edit with real secrets — see backend/README.md
flask db upgrade
python wsgi.py                  # runs on http://localhost:5000
```

Full details — data model, every endpoint, auth model — are in
[`backend/README.md`](./backend/README.md).

### Frontend

```bash
npm install
cp .env.example .env            # VITE_API_URL, defaults to http://localhost:5000/api
npm run dev                     # runs on http://localhost:5173
```

Both need to be running at the same time for the app to work locally.

## Authentication & ownership

JWT-based auth (register/login return a token, sent as
`Authorization: Bearer <token>` on every subsequent request). Every
watchlist record belongs to exactly one user — the backend scopes every
read, update, and delete to `get_jwt_identity()`, so a request for another
user's data returns `404`, not a leaked "forbidden." Checking a county's
current risk itself doesn't require an account (matching Phase 1's open
behavior); saving it to a watchlist does.

## Data model

**User** — id, email (unique), password_hash, created_at.

**WatchedCounty** — id, user_id (FK → User), county_name, lat, lon,
created_at. One row per user per county.

**RiskLog** — id, watched_county_id (FK → WatchedCounty), score, level,
rainfall, humidity, temp, recorded_at. A WatchedCounty has many RiskLog
entries — this is what powers the trend view.

## Features

- Search or browse all 47 counties; no account required to check risk
- Register / log in; per-user saved watchlist with full CRUD (add, view,
  rename/swap the county, remove)
- Risk history per watched county, persisted server-side
- 16-day forecast, 7/16-day toggle
- County comparison view (up to 3 side by side)
- Downloadable risk-summary card (PNG)
- Optional browser notifications for high-risk alerts
- Dark/light theme, metric/imperial units, English/Swahili — all persisted
- Loading, error (with retry), and empty states throughout; an error
  boundary catches any unexpected render failure instead of a blank page

## Known limitations

- The risk-scoring thresholds are a transparent educational heuristic, not
  a clinical or epidemiological model — see the in-app Methodology page
- County coordinates point to each county's main town, not a precise
  centroid
- Browser notifications only fire while the tab is open (no push server)
- Swahili translation covers navigation and key headings, not every
  dynamic string

## Roadmap

**Phase 3:** was originally scoped for authentication, but auth landed in
Phase 2 to match the actual assignment requirements. Phase 3 will instead
focus on production hardening: rate limiting, refresh tokens, and
deployment polish.
