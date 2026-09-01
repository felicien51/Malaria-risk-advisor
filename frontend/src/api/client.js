const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const REFRESH_TOKEN_KEY = "mra:refreshToken";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithColdStartRetry(url, options) {
  // Free-tier hosting (e.g. Render) spins the backend down after
  // inactivity; the first request after that can take 30-60s to wake it,
  // well past a normal fetch's patience. Retry once after a short pause
  // before giving up, so a cold start doesn't look like the backend being
  // down outright.
  try {
    return await fetch(url, options);
  } catch {
    await sleep(4000);
    return await fetch(url, options);
  }
}

// Access tokens are short-lived (15 min) by design — see backend/config.py.
// A single in-flight refresh is shared across concurrent requests so a
// page that fires several authenticated calls at once (e.g. dashboard +
// watchlist on load) doesn't trigger a duplicate refresh for each one.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = fetchWithColdStartRetry(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    })
      .then(async (resp) => {
        if (!resp.ok) return null;
        const data = await resp.json().catch(() => null);
        return data?.token || null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request(path, { method = "GET", body, token, skipAuthHeader = false, _isRetry = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token && !skipAuthHeader) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetchWithColdStartRetry(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. If this is the first request in a while, the backend may be waking up from a free-tier cold start — please try again in a moment.",
      0
    );
  }

  // A 401 on an authenticated call usually means the access token expired
  // (15 min lifetime). Rather than surfacing that to the user as a logout,
  // silently trade the refresh token for a new access token and retry the
  // original request once. onTokenRefreshed lets AuthContext know so its
  // own state (and future requests) picks up the new token too.
  if (response.status === 401 && token && !skipAuthHeader && !_isRetry && path !== "/auth/refresh") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestInternals.onTokenRefreshed?.(newToken);
      return request(path, { method, body, token: newToken, skipAuthHeader, _isRetry: true });
    }
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // no body
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  }
  return data;
}

// AuthContext registers a callback here so a silent refresh triggered deep
// inside an API call (e.g. from a page's data-fetching hook) still updates
// the token held in React state and localStorage, not just the one used
// for that single retried request.
const requestInternals = { onTokenRefreshed: null };
function setOnTokenRefreshed(callback) {
  requestInternals.onTokenRefreshed = callback;
}

export const api = {
  register: (username, email, password) => request("/auth/register", { method: "POST", body: { username, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/auth/me", { token }),
  updateProfile: (patch, token) => request("/auth/me", { method: "PATCH", body: patch, token }),
  refresh: (refreshToken) => request("/auth/refresh", { method: "POST", token: refreshToken }),
  logoutEverywhere: (token) => request("/auth/logout-everywhere", { method: "POST", token }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (email, token, password) =>
    request("/auth/reset-password", { method: "POST", body: { email, token, password } }),

  getRisk: (countyName, token) => request(`/counties/${encodeURIComponent(countyName)}/risk`, { token }),

  listWatchlist: (token) => request("/watchlist", { token }),
  addToWatchlist: (countyName, token) => request("/watchlist", { method: "POST", body: { county_name: countyName }, token }),
  updateWatchlistItem: (id, countyName, token) => request(`/watchlist/${id}`, { method: "PATCH", body: { county_name: countyName }, token }),
  removeFromWatchlist: (id, token) => request(`/watchlist/${id}`, { method: "DELETE", token }),
  watchlistHistory: (id, token) => request(`/watchlist/${id}/history`, { token }),

  sendChatMessage: (message, { countyName, history, token } = {}) =>
    request("/chat/message", {
      method: "POST",
      body: { message, county_name: countyName, history },
      token,
    }),
};

export { ApiError, REFRESH_TOKEN_KEY, setOnTokenRefreshed };
