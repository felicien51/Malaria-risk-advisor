const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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

async function request(path, { method = "GET", body, token, skipAuthHeader = false } = {}) {
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

export const api = {
  register: (username, email, password) => request("/auth/register", { method: "POST", body: { username, email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/auth/me", { token }),
  forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (email, token, password) =>
    request("/auth/reset-password", { method: "POST", body: { email, token, password } }),

  getRisk: (countyName, token) => request(`/counties/${encodeURIComponent(countyName)}/risk`, { token }),

  listWatchlist: (token) => request("/watchlist", { token }),
  addToWatchlist: (countyName, token) => request("/watchlist", { method: "POST", body: { county_name: countyName }, token }),
  updateWatchlistItem: (id, countyName, token) => request(`/watchlist/${id}`, { method: "PATCH", body: { county_name: countyName }, token }),
  removeFromWatchlist: (id, token) => request(`/watchlist/${id}`, { method: "DELETE", token }),
  watchlistHistory: (id, token) => request(`/watchlist/${id}/history`, { token }),
};

export { ApiError };
