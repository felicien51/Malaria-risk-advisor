import { NavLink, Outlet } from "react-router-dom";
import { usePreferences } from "../context/PreferencesContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Layout() {
  const { theme, toggleTheme, units, toggleUnits } = usePreferences();
  const { lang, toggleLang, t } = useLanguage();

  return (
    <div className="app-shell" lang={lang}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="top-nav">
        <NavLink to="/" className="brand" aria-label="Malaria Risk Advisor home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">Malaria Risk Advisor</span>
        </NavLink>
        <div className="nav-right">
          <nav aria-label="Main navigation">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navHome")}
            </NavLink>
            <NavLink to="/compare" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navCompare")}
            </NavLink>
            
            <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navAbout")}
            </NavLink>
          </nav>
          <button className="icon-btn" onClick={toggleLang} aria-label="Toggle language">
            {lang === "en" ? "EN" : "SW"}
          </button>
          <button className="icon-btn" onClick={toggleUnits} aria-label="Toggle units">
            {units === "metric" ? "°C / mm" : "°F / in"}
          </button>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>Data from Open-Meteo &middot; {t("disclaimer")}</footer>
    </div>
  );
}
