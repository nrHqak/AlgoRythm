import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { LevelBadge } from "./LevelBadge";
import { StreakBadge } from "./StreakBadge";

function getInitials(name) {
  const value = (name || "AR").trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
}

export function Layout({ children }) {
  const { user, signOut } = useAuth();
  const { profile, levelMeta } = useProfile();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  const initials = getInitials(profile?.username || user?.email || "AR");

  return (
    <div className="app-shell">
      <nav className="layout-nav">
        <NavLink to="/learn" className="brand">
          <span className="brand-mark">A</span>
          <span>AlgoRythm</span>
        </NavLink>

        <div className="nav-links">
          <NavLink to="/learn" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            Learn
          </NavLink>
          <NavLink to="/playground" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            Playground
          </NavLink>
          <NavLink to="/mentor" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            Mentor
          </NavLink>
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <div className="nav-desktop-only">
                <StreakBadge streak={profile?.streak || 0} />
              </div>
              <div className="nav-desktop-only">
                <LevelBadge level={levelMeta.level} title={levelMeta.title} />
              </div>
              <button className="avatar-button" type="button" onClick={() => navigate("/profile")}>
                {initials}
              </button>
              <button className="secondary-button nav-desktop-only" type="button" onClick={handleSignOut}>
                Sign Out
              </button>
              <button
                className="secondary-button mobile-menu-button"
                type="button"
                onClick={() => setMenuOpen((previous) => !previous)}
              >
                Menu
              </button>
            </>
          ) : (
            <button className="primary-button" type="button" onClick={() => navigate("/auth")}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {menuOpen ? (
        <div className="hamburger-panel">
          <div className="nav-links">
            <NavLink
              to="/learn"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Learn
            </NavLink>
            <NavLink
              to="/playground"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Playground
            </NavLink>
            <NavLink
              to="/mentor"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Mentor
            </NavLink>
            <button className="nav-link secondary-button" type="button" onClick={() => navigate("/profile")}>
              Profile
            </button>
            <button className="nav-link secondary-button" type="button" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      ) : null}

      <div className="page-grid">{children}</div>
    </div>
  );
}
