import { createContext, useContext, useEffect, useState } from "react";

const PreferencesContext = createContext(null);

const THEME_KEY = "mra:theme";
const UNITS_KEY = "mra:units";

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "dark");
  const [units, setUnits] = useState(() => localStorage.getItem(UNITS_KEY) || "metric");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(UNITS_KEY, units);
  }, [units]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const toggleUnits = () => setUnits((u) => (u === "metric" ? "imperial" : "metric"));

  return (
    <PreferencesContext.Provider value={{ theme, toggleTheme, units, toggleUnits }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}

// Conversion helpers
export function formatTemp(celsius, units) {
  if (units === "imperial") {
    return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(celsius * 10) / 10}°C`;
}

export function formatRainfall(mm, units) {
  if (units === "imperial") {
    return `${Math.round((mm / 25.4) * 100) / 100} in`;
  }
  return `${mm} mm`;
}
