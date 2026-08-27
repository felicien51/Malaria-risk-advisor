import { useState, useEffect, useCallback } from "react";

const KEY = "mra:recent-counties";
const MAX_RECENT = 5;

export function useRecentCounties() {
  const [recent, setRecent] = useState(() => {
    try {
      const stored = localStorage.getItem(KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addRecent = useCallback((countyName) => {
    setRecent((prev) => {
      const next = [countyName, ...prev.filter((c) => c !== countyName)].slice(0, MAX_RECENT);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, addRecent };
}
