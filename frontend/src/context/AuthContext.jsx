import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, ApiError, REFRESH_TOKEN_KEY, setOnTokenRefreshed } from "../api/client";

const AuthContext = createContext(null);
const TOKEN_KEY = "mra:token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready

  // Whenever a request silently refreshes an expired access token (see
  // api/client.js), sync that new token into both React state and
  // localStorage so subsequent renders/requests use it too, without the
  // user ever seeing a logout.
  useEffect(() => {
    setOnTokenRefreshed((newToken) => {
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
    });
    return () => setOnTokenRefreshed(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    api
      .me(token)
      .then((data) => {
        setUser(data);
        setStatus("ready");
      })
      .catch((err) => {
        // Only clear the session when the server actually rejected the
        // token (expired/invalid) AND the refresh attempt inside the API
        // client also failed (it already retries once before this catch
        // ever sees a 401 — see api/client.js). A network error (status 0)
        // or a transient server issue shouldn't log the user out.
        if (err instanceof ApiError && (err.status === 401 || err.status === 422)) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
        setStatus("ready");
      });
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await api.register(username, email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Invalidates every token issued to this account (this device included)
  // rather than just clearing local storage — useful if a device was lost
  // or a session looks compromised. Falls back to a plain local logout if
  // the request itself fails, so the user isn't stuck "logged in" locally
  // when the server call didn't go through.
  const logoutEverywhere = useCallback(async () => {
    try {
      if (token) await api.logoutEverywhere(token);
    } finally {
      logout();
    }
  }, [token, logout]);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isReady: status === "ready",
    login,
    register,
    logout,
    logoutEverywhere,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
