import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { TaskCard } from "../components/TaskCard";
import { StreakBadge } from "../components/StreakBadge";
import { XPBar } from "../components/XPBar";
import { useAuth } from "../hooks/useAuth.jsx";
import { useProfile } from "../hooks/useProfile.jsx";
import { supabase } from "../lib/supabase";

function getApiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

function buildStatusMap(tasks, progressRows) {
  const progressByTask = new Map(progressRows.map((row) => [row.task_id, row]));
  const completedOrderIndexes = new Set(
    tasks.filter((task) => progressByTask.get(task.id)?.status === "completed").map((task) => task.order_index)
  );

  return tasks.reduce((map, task) => {
    const progress = progressByTask.get(task.id);
    if (progress?.status === "completed") {
      map[task.id] = "completed";
      return map;
    }

    if (task.order_index === 1) {
      map[task.id] = "unlocked";
      return map;
    }

    const previousCompleted = completedOrderIndexes.has(task.order_index - 1);
    map[task.id] = previousCompleted || progress?.status === "unlocked" ? "unlocked" : "locked";
    return map;
  }, {});
}

export function LearnPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [taskResponse, progressResponse] = await Promise.all([
          fetch(getApiUrl("/curriculum")),
          supabase.from("task_progress").select("*").eq("user_id", user.id),
        ]);

        if (!taskResponse.ok) {
          throw new Error(`Curriculum request failed with status ${taskResponse.status}.`);
        }

        const taskPayload = await taskResponse.json();
        if (progressResponse.error) {
          throw progressResponse.error;
        }

        setTasks(Array.isArray(taskPayload.tasks) ? taskPayload.tasks : []);
        setProgressRows(progressResponse.data || []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load curriculum.");
      } finally {
        setLoading(false);
      }
    }

    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const statusMap = buildStatusMap(tasks, progressRows);
  const progressByTask = new Map(progressRows.map((row) => [row.task_id, row]));
  const completedCount = progressRows.filter((row) => row.status === "completed").length;

  const groupedTasks = {
    beginner: tasks.filter((task) => task.difficulty === "beginner"),
    intermediate: tasks.filter((task) => task.difficulty === "intermediate"),
    advanced: tasks.filter((task) => task.difficulty === "advanced"),
  };

  return (
    <>
      <section className="hero-banner">
        <div>
          <div className="eyebrow">Learning Path</div>
          <h1>Move from first trace to disciplined algorithm thinking.</h1>
          <p className="meta-text">
            Progress unlocks in order. Finish tasks, earn XP, and build a steady streak through daily runs.
          </p>
          <div className="meta-text">
            {completedCount} / {tasks.length || 5} tasks completed
          </div>
        </div>
        <div className="panel-stack">
          <StreakBadge streak={profile?.streak || 0} />
          <XPBar xp={profile?.xp || 0} />
        </div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      {loading ? (
        <div className="page-loading">Loading curriculum...</div>
      ) : (
        <section className="learn-columns">
          {["beginner", "intermediate", "advanced"].map((difficulty) => (
            <div key={difficulty} className="learn-column">
              <div className="difficulty-header">
                <h2 className="section-title">{difficulty[0].toUpperCase() + difficulty.slice(1)}</h2>
                <span className={`difficulty-badge ${difficulty}`}>{groupedTasks[difficulty].length} tasks</span>
              </div>

              {groupedTasks[difficulty].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  status={statusMap[task.id] || "locked"}
                  userProgress={progressByTask.get(task.id)}
                  onOpen={() => navigate(`/learn/${task.id}`)}
                />
              ))}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
