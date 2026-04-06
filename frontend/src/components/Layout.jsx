import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";
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
  const { locale, setLocale, t } = useLocale();
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
        <NavLink to="/" className="brand">
          <span className="wordmark">
            <strong>AlgoRythm</strong>
            <small>{t("nav.tagline")}</small>
          </span>
        </NavLink>

        <div className="nav-links">
          <NavLink to="/learn" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            {t("common.learn")}
          </NavLink>
          <NavLink to="/playground" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            {t("common.playground")}
          </NavLink>
          <NavLink to="/mentor" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            {t("common.mentor")}
          </NavLink>
        </div>

        <div className="nav-right">
          <div className="locale-switch">
            <button
              className={`locale-button${locale === "en" ? " is-active" : ""}`}
              type="button"
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <button
              className={`locale-button${locale === "ru" ? " is-active" : ""}`}
              type="button"
              onClick={() => setLocale("ru")}
            >
              RU
            </button>
          </div>
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
                {t("common.signOut")}
              </button>
              <button
                className="secondary-button mobile-menu-button"
                type="button"
                onClick={() => setMenuOpen((previous) => !previous)}
              >
                {t("common.menu")}
              </button>
            </>
          ) : (
            <button className="primary-button" type="button" onClick={() => navigate("/auth")}>
              {t("common.signIn")}
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
              {t("common.learn")}
            </NavLink>
            <NavLink
              to="/playground"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {t("common.playground")}
            </NavLink>
            <NavLink
              to="/mentor"
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {t("common.mentor")}
            </NavLink>
            <button className="nav-link secondary-button" type="button" onClick={() => navigate("/profile")}>
              {t("common.profile")}
            </button>
            <button className="nav-link secondary-button" type="button" onClick={handleSignOut}>
              {t("common.signOut")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="page-grid">{children}</div>
    </div>
  );
}
