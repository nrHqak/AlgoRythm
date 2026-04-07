import { useEffect, useMemo, useState } from "react";

import { AlgorithmDNA } from "../components/AlgorithmDNA";
import { LevelBadge } from "../components/LevelBadge";
import { StreakBadge } from "../components/StreakBadge";
import { XPBar } from "../components/XPBar";
import { useAuth } from "../hooks/useAuth.jsx";
import { useDNA } from "../hooks/useDNA";
import { useLocale } from "../hooks/useLocale.jsx";
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

function getDaysAgo(dateValue, t) {
  if (!dateValue) {
    return t("profile.noRecentActivity");
  }

  const today = new Date();
  const previous = new Date(dateValue);
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - previous.setHours(0, 0, 0, 0)) / 86400000);

  if (diff <= 0) return t("common.today");
  if (diff === 1) return t("profile.oneDayAgo");
  return `${diff} ${t("profile.daysAgo")}`;
}

function buildHeatmap(sessions) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 83);
  const counts = new Map();

  sessions.forEach((session) => {
    const key = new Date(session.created_at).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const days = [];
  for (let index = 0; index < 84; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    days.push({
      key,
      count: counts.get(key) || 0,
      label: day.toLocaleDateString(),
    });
  }
  return days;
}

export function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { profile, levelMeta } = useProfile();
  const { dna, loading: dnaLoading } = useDNA(user?.id);
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

  const heatmapDays = useMemo(() => buildHeatmap(sessions), [sessions]);
  const activeDays = heatmapDays.filter((day) => day.count > 0).length;
  const successRate = totalSessions > 0 ? Math.round((sessions.filter((session) => session.solved).length / totalSessions) * 100) : 0;
  const runsThisWeek = sessions.filter((session) => {
    const diff = Date.now() - new Date(session.created_at).getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const averageXp = totalSessions > 0 ? Math.round((sessions.reduce((sum, session) => sum + (session.xp_earned || 0), 0) / totalSessions) * 10) / 10 : 0;
  const algorithmMix = useMemo(() => {
    const counts = {};
    sessions.forEach((session) => {
      const key = session.algorithm_type || "custom";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [sessions]);
  const longestRun = useMemo(() => {
    let best = 0;
    let current = 0;
    let previous = null;
    heatmapDays.forEach((day) => {
      if (day.count > 0) {
        if (previous && new Date(day.key) - new Date(previous) === 86400000) {
          current += 1;
        } else {
          current = 1;
        }
        best = Math.max(best, current);
        previous = day.key;
      }
    });
    return best;
  }, [heatmapDays]);

  return (
    <>
      <section className="hero-banner profile-top">
        <div className="profile-top-row">
          <div className="profile-user">
            <div className="avatar-large">{getInitials(profile?.username || user?.email || "AR")}</div>
            <div>
              <h1 style={{ margin: 0 }}>{profile?.username || t("profile.titleFallback")}</h1>
              <div className="meta-text">{user?.email}</div>
              <div className="button-row" style={{ marginTop: "12px" }}>
                <LevelBadge level={levelMeta.level} title={levelMeta.title} />
                <StreakBadge streak={profile?.streak || 0} />
              </div>
            </div>
          </div>
          <XPBar xp={profile?.xp || 0} />
        </div>

        <div className="meta-text">{t("profile.lastActive")}: {getDaysAgo(profile?.last_active_date, t)}</div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <AlgorithmDNA dna={dna} loading={dnaLoading} />

      <section className="stats-grid">
        <article className="stat-card">
          <h3>{t("profile.totalSessions")}</h3>
          <div className="stat-value">{totalSessions}</div>
        </article>
        <article className="stat-card">
          <h3>{t("profile.tasksCompleted")}</h3>
          <div className="stat-value">{completedTasks.length}</div>
        </article>
        <article className="stat-card">
          <h3>{t("profile.commonError")}</h3>
          <div className="stat-value">{mostCommonErrorType}</div>
        </article>
        <article className="stat-card">
          <h3>{t("profile.totalXp")}</h3>
          <div className="stat-value">{profile?.xp || 0}</div>
        </article>
        <article className="stat-card">
          <h3>{t("profile.favoriteAlgorithm")}</h3>
          <div className="stat-value">{favoriteAlgorithm}</div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-panel">
          <div className="panel-header">
            <div>
              <h2>{t("profile.consistency")}</h2>
              <p>{t("profile.consistencySubtitle")}</p>
            </div>
          </div>
          <div className="dashboard-stats">
            <div className="dashboard-kpi">
              <span>{t("profile.activeDays")}</span>
              <strong>{activeDays}</strong>
            </div>
            <div className="dashboard-kpi">
              <span>{t("profile.successRate")}</span>
              <strong>{successRate}%</strong>
            </div>
            <div className="dashboard-kpi">
              <span>{t("profile.runsThisWeek")}</span>
              <strong>{runsThisWeek}</strong>
            </div>
            <div className="dashboard-kpi">
              <span>{t("profile.averageXp")}</span>
              <strong>{averageXp}</strong>
            </div>
          </div>
        </article>

        <article className="panel heatmap-panel">
          <div className="panel-header">
            <div>
              <h2>{t("profile.heatmapTitle")}</h2>
              <p>{t("profile.heatmapSubtitle")}</p>
            </div>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">{t("profile.noSessions")}</div>
          ) : (
            <div className="heatmap-grid">
              {heatmapDays.map((day) => (
                <div
                  key={day.key}
                  className={`heatmap-cell intensity-${Math.min(day.count, 4)}`}
                  title={`${day.label}: ${day.count}`}
                />
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>{t("profile.algorithmMix")}</h2>
            </div>
          </div>
          <div className="mix-list">
            {algorithmMix.length === 0 ? (
              <div className="empty-state">{t("profile.noSessions")}</div>
            ) : (
              algorithmMix.map(([name, count]) => {
                const width = Math.max((count / Math.max(...algorithmMix.map((item) => item[1]))) * 100, 12);
                return (
                  <div key={name} className="mix-row">
                    <div className="mix-copy">
                      <strong>{name}</strong>
                      <span>{count}</span>
                    </div>
                    <div className="mix-bar">
                      <div className="mix-fill" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>{t("profile.streakInsights")}</h2>
            </div>
          </div>
          <div className="insight-list">
            <div className="insight-card">
              <span>{t("profile.longestRun")}</span>
              <strong>{longestRun}</strong>
            </div>
            <div className="insight-card">
              <span>{t("profile.currentRhythm")}</span>
              <strong>{profile?.streak || 0}</strong>
            </div>
            <div className="insight-card">
              <span>{t("profile.weeklyOutput")}</span>
              <strong>{runsThisWeek}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{t("profile.achievements")}</h2>
            <p>{t("profile.achievementsSubtitle")}</p>
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
            <h2>{t("profile.recentSessions")}</h2>
            <p>{t("profile.recentSessionsSubtitle")}</p>
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
                        {session.solved ? t("profile.pass") : t("profile.fail")}
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
