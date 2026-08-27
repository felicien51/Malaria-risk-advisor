const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, token, skipAuthHeader = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token && !skipAuthHeader) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError("Could not reach the server. Is the backend running?", 0);
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

  getRisk: (countyName, token) => request(`/counties/${encodeURIComponent(countyName)}/risk`, { token }),

  listWatchlist: (token) => request("/watchlist", { token }),
  addToWatchlist: (countyName, token) => request("/watchlist", { method: "POST", body: { county_name: countyName }, token }),
  updateWatchlistItem: (id, countyName, token) => request(`/watchlist/${id}`, { method: "PATCH", body: { county_name: countyName }, token }),
  removeFromWatchlist: (id, token) => request(`/watchlist/${id}`, { method: "DELETE", token }),
  watchlistHistory: (id, token) => request(`/watchlist/${id}/history`, { token }),
};

export { ApiError };
