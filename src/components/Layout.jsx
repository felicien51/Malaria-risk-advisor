import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <NavLink to="/" className="brand">
          <span className="brand-mark">M</span>
          <span className="brand-name">Malaria Risk Advisor</span>
        </NavLink>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Home
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? "active" : "")}>
            Methodology
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>Data from Open-Meteo &middot; Educational estimate, not medical advice</footer>
    </div>
  );
}
