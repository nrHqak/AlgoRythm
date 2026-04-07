import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AlgorithmPet } from "../components/AlgorithmPet";
import { DailyQuizCard } from "../components/DailyQuizCard";
import { TaskCard } from "../components/TaskCard";
import { StreakBadge } from "../components/StreakBadge";
import { XPBar } from "../components/XPBar";
import { useAuth } from "../hooks/useAuth.jsx";
import { useDailyQuiz } from "../hooks/useDailyQuiz";
import { useLocale } from "../hooks/useLocale.jsx";
import { usePet } from "../hooks/usePet";
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
  const { locale, t } = useLocale();
  const { profile, refreshProfile } = useProfile();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [progressRows, setProgressRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ritualNotice, setRitualNotice] = useState("");
  const [feedBusy, setFeedBusy] = useState(false);
  const { pet, loading: petLoading, error: petError, feedPet, addPetProgress } = usePet(user?.id, profile?.xp || 0);
  const quiz = useDailyQuiz(user?.id, locale, async (reward) => {
    await addPetProgress(reward.correct ? 12 : 4, reward.correct ? 8 : 2, reward.correct ? 4 : 1);
    await refreshProfile();
    setRitualNotice(
      t("learn.quizReward")
        .replace("{xp}", String(reward.xpEarned))
        .replace("{status}", reward.correct ? t("learn.quizCorrectWord") : t("learn.quizPracticeWord"))
    );
  });

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
        setError(loadError.message || t("learn.loading"));
      } finally {
        setLoading(false);
      }
    }

    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!ritualNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setRitualNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [ritualNotice]);

  async function handleFeedPet() {
    setFeedBusy(true);
    const result = await feedPet();
    if (result?.ok) {
      setRitualNotice(t("learn.feedSuccess"));
    } else if (result?.alreadyFed) {
      setRitualNotice(t("learn.feedDone"));
    }
    setFeedBusy(false);
  }

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
          <div className="eyebrow">{t("learn.eyebrow")}</div>
          <h1>{t("learn.title")}</h1>
          <p className="meta-text">{t("learn.subtitle")}</p>
          <div className="meta-text">
            {completedCount} / {tasks.length || 5} {t("learn.completed")}
          </div>
        </div>
        <div className="panel-stack">
          <StreakBadge streak={profile?.streak || 0} />
          <XPBar xp={profile?.xp || 0} />
        </div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}
      {ritualNotice ? <div className="status-banner is-success">{ritualNotice}</div> : null}

      <section className="ritual-grid">
        <AlgorithmPet
          pet={pet}
          loading={petLoading}
          error={petError}
          onFeed={handleFeedPet}
          feedBusy={feedBusy}
          copy={{
            title: t("learn.petTitle"),
            subtitle: t("learn.petSubtitle"),
            growthLabel: t("learn.petGrowth"),
            stageIntro: t("learn.petStageIntro"),
            stageLabels: {
              seed: t("learn.petStageSeed"),
              spark: t("learn.petStageSpark"),
              sprite: t("learn.petStageSprite"),
              guardian: t("learn.petStageGuardian"),
              legend: t("learn.petStageLegend"),
            },
            mood: t("learn.petMood"),
            energy: t("learn.petEnergy"),
            hunger: t("learn.petHunger"),
            feedAction: t("learn.petFeedAction"),
            feedDone: t("learn.petFeedDone"),
            feedHint: t("learn.petFeedHint"),
            feedCooldown: t("learn.petFeedCooldown"),
          }}
        />

        <DailyQuizCard
          quiz={quiz}
          loading={quiz.loading}
          error={quiz.error}
          onAnswer={quiz.submitAnswer}
          busy={quiz.submitting}
          onOpenPlayground={() => navigate("/playground")}
          copy={{
            title: t("learn.quizTitle"),
            subtitle: t("learn.quizSubtitle"),
            progress: t("learn.quizProgress"),
            ready: t("learn.quizReady"),
            startTitle: t("learn.quizStartTitle"),
            startText: t("learn.quizStartText"),
            startAction: t("learn.quizStartAction"),
            complete: t("learn.quizComplete"),
            correct: t("learn.quizCorrect"),
            incorrect: t("learn.quizIncorrect"),
            timeout: t("learn.quizTimeout"),
            completeTitle: t("learn.quizCompleteTitle"),
            completeText: t("learn.quizCompleteText"),
            playgroundCta: t("learn.quizPlaygroundCta"),
            questionLabel: t("learn.quizQuestionLabel"),
          }}
        />
      </section>

      {loading ? (
        <div className="page-loading">{t("learn.loading")}</div>
      ) : (
        <section className="learn-columns">
          {["beginner", "intermediate", "advanced"].map((difficulty) => (
            <div key={difficulty} className="learn-column">
              <div className="difficulty-header">
                <h2 className="section-title">{t(`learn.${difficulty}`)}</h2>
                <span className={`difficulty-badge ${difficulty}`}>{groupedTasks[difficulty].length} {t("learn.tasks")}</span>
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
