import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SettingsMenu from "./SettingsMenu.jsx";

export default function Layout() {
  const { lang, t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

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
            {isAuthenticated && (
              <NavLink to="/watchlist" className={({ isActive }) => (isActive ? "active" : "")}>
                Watchlist
              </NavLink>
            )}
            <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navAbout")}
            </NavLink>
          </nav>

          <div className="nav-divider" aria-hidden="true" />

          {isAuthenticated ? (
            <div className="auth-nav">
              <span className="auth-email" title={user?.email}>{user?.username || user?.email}</span>
              <button className="icon-btn" onClick={handleLogout}>Log out</button>
            </div>
          ) : (
            <div className="auth-nav">
              <NavLink to="/login" className="icon-btn">Log in</NavLink>
              <NavLink to="/register" className="icon-btn icon-btn-accent">Register</NavLink>
            </div>
          )}

          <SettingsMenu />
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>Data from Open-Meteo &middot; {t("disclaimer")}</footer>
    </div>
  );
}
