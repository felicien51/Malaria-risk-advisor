# Malaria Risk Advisor

A React application that estimates weather-driven malaria transmission risk
for any of Kenya's 47 counties, using live rainfall, humidity and temperature
data. Built as Phase 1 of a 3-phase capstone (React frontend → Flask +
PostgreSQL backend → authentication).

**Live demo:** https://malaria-risk-advisor.vercel.app/

## Problem

Malaria transmission risk rises and falls with weather: rainfall creates
standing water for mosquito breeding, humidity extends mosquito lifespan, and
warm temperatures speed up parasite development. This app turns that
relationship into a simple, transparent risk score so a user can check
conditions for their county at a glance, rather than needing to interpret raw
weather data themselves.

## Live features

- Search/browse all 47 Kenyan counties, with a "recently viewed" quick list
- A 0-100 risk score (Low / Moderate / High) computed from the trailing
  14 days of weather, with a visible breakdown of what drove the score
- A 16-day forward forecast (rainfall + temperature) with a 7/16-day toggle
- **Compare view** — put up to 3 counties side by side
- **Kenya risk map** — all 47 counties plotted and colored by current risk
  (approximate positions by coordinate, not official GIS county boundaries)
- **Session risk history** — a small sparkline showing how a county's score
  moved during your visit (resets on reload, not persisted — that's Phase 2)
- **Shareable link** — copy a direct link to a county's dashboard
- **Downloadable risk card** — exports a PNG summary card via the Canvas API
- **Optional high-risk browser notifications** — opt in per county; requires
  browser permission and the tab to stay open (no push server yet)
- **Dark/light theme** and **metric/imperial units**, both persisted locally
- **English/Swahili** toggle for the app's navigation and key headings
  (scoped to UI chrome, not a full translation of every dynamic string)
- A methodology page explaining exactly how the score is calculated
- Loading, error (with retry), and empty states throughout
- Accessibility basics: skip-to-content link, aria-live regions for
  loading/copy states, aria-labels on icon-only buttons, keyboard-focusable
  controls

## Setup instructions

```bash
git clone <your-repo-url>
cd malaria-risk-advisor
npm install
npm run dev
```

The app runs at `http://localhost:5173`. No environment variables or API
keys are required.

To build for production:

```bash
npm run build
npm run preview
```

## API used

**[Open-Meteo](https://open-meteo.com/)** - free weather API, no API key
required, no published rate limit for non-commercial use.

Endpoint: `GET https://api.open-meteo.com/v1/forecast`

Parameters used:
- `latitude`, `longitude` - county coordinates (hardcoded lookup table,
  since Kenya's 47 counties are a fixed set)
- `daily` - `temperature_2m_max`, `temperature_2m_min`, `precipitation_sum`,
  `relative_humidity_2m_mean`, `wind_speed_10m_max`
- `past_days=14` - trailing window used for the risk score
- `forecast_days=16` - forward outlook (`forecast_days=1` on the map view,
  which only needs the current score per county, not a full forecast)

The map view fetches all 47 counties in small batches of 8 concurrent
requests rather than all at once, to be polite to the API.

## Risk-scoring logic

The score is a transparent, weighted heuristic (not a medical model):

| Factor | Weight | Basis |
|---|---|---|
| Rainfall (14-day total) | 40% | Standing water for larval breeding |
| Humidity (14-day average) | 30% | >60% extends adult mosquito lifespan |
| Temperature (14-day average) | 30% | 20-30C speeds parasite development |

See `src/utils/riskScore.js` for the exact calculation.

## Project structure

```
src/
  components/   RiskGauge, ForecastChart, Layout, Sparkline
  pages/        Home, Dashboard, Forecast, Compare, MapView, About
  hooks/        useWeatherData, useRecentCounties, useSessionRiskLog,
                useRiskNotifications, useAllCountiesRisk
  context/      PreferencesContext (theme/units), LanguageContext (en/sw)
  utils/        riskScore.js (scoring logic), downloadCard.js (PNG export)
  data/         counties.js (47 counties with coordinates)
```

## Known limitations / possible improvements

- County coordinates point to the county's main town, not a precise
  centroid - risk is representative of that area, not hyper-local
- The risk-scoring thresholds are a simplified educational heuristic based
  on documented environmental drivers of transmission, not a clinical or
  epidemiological model, and should not be used for medical decisions
- The Kenya risk map plots counties by coordinate, not real GIS county
  border shapes — there was no offline Kenya county GeoJSON available
- Browser notifications only fire while the tab is open (no service worker
  or push server) — a genuinely reliable alert system needs a Phase 2/3
  backend
- Swahili translation covers navigation and key headings only, not every
  dynamic string
- No cross-session persistence yet — recently viewed counties and unit/theme
  preferences use localStorage, but saved watchlists and risk history don't
  survive a full data reset (planned properly for Phase 2 with a real
  backend + database)
- No user accounts yet (planned for Phase 3)

## Roadmap (Phases 2 and 3)

- **Phase 2:** Flask + PostgreSQL backend proxying Open-Meteo, persisting
  saved counties and historical risk scores, and a real push-notification
  service
- **Phase 3:** Authentication so each user has their own saved counties,
  alert preferences, and risk history
