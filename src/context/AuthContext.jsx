import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, ApiError } from "../api/client";

const AuthContext = createContext(null);
const TOKEN_KEY = "mra:token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready

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
      .catch(() => {
        // Token expired or invalid — clear it silently.
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setStatus("ready");
      });
  }, [token]);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await api.register(username, email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    isReady: status === "ready",
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
