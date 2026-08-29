import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const MAX_RECENT = 5;

// Guests share one list; each logged-in user gets their own, keyed by id,
// so a fresh account never inherits another account's (or a guest's)
// browsing history on the same device.
function keyFor(user) {
  return user ? `mra:recent-counties:${user.id}` : "mra:recent-counties:guest";
}

export function useRecentCounties() {
  const { user, isReady } = useAuth();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (!isReady) return;
    try {
      const stored = localStorage.getItem(keyFor(user));
      setRecent(stored ? JSON.parse(stored) : []);
    } catch {
      setRecent([]);
    }
  }, [user, isReady]);

  const addRecent = useCallback(
    (countyName) => {
      setRecent((prev) => {
        const next = [countyName, ...prev.filter((c) => c !== countyName)].slice(0, MAX_RECENT);
        try {
          localStorage.setItem(keyFor(user), JSON.stringify(next));
        } catch {
          // localStorage unavailable — recent counties just won't persist
        }
        return next;
      });
    },
    [user]
  );

  return { recent, addRecent };
}
