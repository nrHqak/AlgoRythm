import { useEffect, useMemo, useState } from "react";

import { LevelBadge } from "../components/LevelBadge";
import { StreakBadge } from "../components/StreakBadge";
import { XPBar } from "../components/XPBar";
import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { supabase } from "../lib/supabase";

function getInitials(value) {
  const source = (value || "AR").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getDaysAgo(dateValue) {
  if (!dateValue) {
    return "No recent activity";
  }

  const today = new Date();
  const previous = new Date(dateValue);
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - previous.setHours(0, 0, 0, 0)) / 86400000);

  if (diff <= 0) return "today";
  if (diff === 1) return "1 day ago";
  return `${diff} days ago`;
}

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, levelMeta } = useProfile();
  const [allAchievements, setAllAchievements] = useState([]);
  const [earnedAchievements, setEarnedAchievements] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [taskProgress, setTaskProgress] = useState([]);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfileData() {
      setError("");

      try {
        const [achievementsRes, earnedRes, sessionsRes, progressRes] = await Promise.all([
          supabase.from("achievements").select("*").order("title"),
          supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
          supabase.from("sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
          supabase.from("task_progress").select("*").eq("user_id", user.id),
        ]);

        if (achievementsRes.error) throw achievementsRes.error;
        if (earnedRes.error) throw earnedRes.error;
        if (sessionsRes.error) throw sessionsRes.error;
        if (progressRes.error) throw progressRes.error;

        setAllAchievements(achievementsRes.data || []);
        setEarnedAchievements(earnedRes.data || []);
        setSessions(sessionsRes.data || []);
        setTaskProgress(progressRes.data || []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load profile data.");
      }
    }

    if (user?.id) {
      loadProfileData();
    }
  }, [user?.id]);

  const earnedSet = useMemo(() => new Set(earnedAchievements.map((item) => item.achievement_id)), [earnedAchievements]);
  const completedTasks = taskProgress.filter((item) => item.status === "completed");
  const totalSessions = sessions.length;
  const mostCommonErrorType = useMemo(() => {
    const counts = {};
    sessions.forEach((session) => {
      const key = session.error?.type || session.error?.type === "" ? session.error.type : null;
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "None";
  }, [sessions]);

  const favoriteAlgorithm = useMemo(() => {
    const counts = {};
    sessions.forEach((session) => {
      const key = session.algorithm_type || "custom";
      counts[key] = (counts[key] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "custom";
  }, [sessions]);

  return (
    <>
      <section className="hero-banner profile-top">
        <div className="profile-top-row">
          <div className="profile-user">
            <div className="avatar-large">{getInitials(profile?.username || user?.email || "AR")}</div>
            <div>
              <h1 style={{ margin: 0 }}>{profile?.username || "Learner"}</h1>
              <div className="meta-text">{user?.email}</div>
              <div className="button-row" style={{ marginTop: "12px" }}>
                <LevelBadge level={levelMeta.level} title={levelMeta.title} />
                <StreakBadge streak={profile?.streak || 0} />
              </div>
            </div>
          </div>
          <XPBar xp={profile?.xp || 0} />
        </div>

        <div className="meta-text">Last active: {getDaysAgo(profile?.last_active_date)}</div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <h3>Total sessions</h3>
          <div className="stat-value">{totalSessions}</div>
        </article>
        <article className="stat-card">
          <h3>Tasks completed</h3>
          <div className="stat-value">{completedTasks.length}</div>
        </article>
        <article className="stat-card">
          <h3>Common error</h3>
          <div className="stat-value">{mostCommonErrorType}</div>
        </article>
        <article className="stat-card">
          <h3>Total XP</h3>
          <div className="stat-value">{profile?.xp || 0}</div>
        </article>
        <article className="stat-card">
          <h3>Favorite algorithm</h3>
          <div className="stat-value">{favoriteAlgorithm}</div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Achievements</h2>
            <p>Earned badges light up as you build consistency and solve tasks.</p>
          </div>
        </div>
        <div className="achievements-grid">
          {allAchievements.map((achievement) => {
            const earned = earnedSet.has(achievement.id);
            return (
              <article
                key={achievement.id}
                className={`achievement-card${earned ? " is-earned" : " is-locked"}`}
              >
                <div className="achievement-row">
                  <div className="achievement-icon">{achievement.icon}</div>
                  <div>
                    <div className="achievement-title">{achievement.title}</div>
                    <div className="meta-text">{achievement.description}</div>
                    <div className="meta-text">+{achievement.xp_reward} XP</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Recent Sessions</h2>
            <p>Review the last 10 runs, including code, XP, and whether the trace completed cleanly.</p>
          </div>
        </div>
        <div className="history-list">
          {sessions.map((session) => {
            const expanded = expandedSessionId === session.id;
            return (
              <article key={session.id} className="history-card">
                <button type="button" onClick={() => setExpandedSessionId(expanded ? null : session.id)}>
                  <div className="session-row-header">
                    <div>
                      <div className="session-title">{session.algorithm_type || "custom"}</div>
                      <div className="session-meta">{new Date(session.created_at).toLocaleString()}</div>
                    </div>
                    <div className="button-row">
                      <span className={`result-pill ${session.solved ? "is-pass" : "is-fail"}`}>
                        {session.solved ? "Pass" : "Fail"}
                      </span>
                      <span className="pill">+{session.xp_earned || 0} XP</span>
                    </div>
                  </div>
                </button>
                {expanded ? <pre className="session-code">{session.code}</pre> : null}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
