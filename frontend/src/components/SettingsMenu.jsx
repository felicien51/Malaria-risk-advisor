import { useState, useRef, useEffect } from "react";
import { usePreferences } from "../context/PreferencesContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function SettingsMenu() {
  const { theme, toggleTheme, units, toggleUnits } = usePreferences();
  const { lang, toggleLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="settings-menu" ref={ref}>
      <button
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-panel" role="menu">
          <button className="settings-row" onClick={toggleLang} role="menuitem">
            <span>Language</span>
            <span className="settings-value">{lang === "en" ? "English" : "Kiswahili"}</span>
          </button>
          <button className="settings-row" onClick={toggleUnits} role="menuitem">
            <span>Units</span>
            <span className="settings-value">{units === "metric" ? "°C / mm" : "°F / in"}</span>
          </button>
          <button className="settings-row" onClick={toggleTheme} role="menuitem">
            <span>Theme</span>
            <span className="settings-value">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
