import { useLocale } from "../hooks/useLocale.jsx";

export function TaskCard({ task, status, userProgress, onOpen }) {
  const { t } = useLocale();
  const isLocked = status === "locked";
  const isCompleted = status === "completed";

  return (
    <article className={`task-card${isLocked ? " is-locked" : ""}${isCompleted ? " is-completed" : ""}`}>
      <div className="task-row">
        <div className="task-icon">{isLocked ? "🔒" : isCompleted ? "✓" : "▶"}</div>
        <span className={`difficulty-badge ${task.difficulty}`}>{task.difficulty}</span>
      </div>

      <div>
        <h3>{task.title}</h3>
        <p className="card-copy">{task.description}</p>
      </div>

      <div className="task-meta">
        <div>
          {t("taskCard.maxXp")}: {task.max_xp}
        </div>
        {isCompleted ? (
          <div>
            {t("taskCard.best")}: {userProgress?.best_steps || "—"} {t("taskCard.steps")}
          </div>
        ) : null}
        {isCompleted ? <div>{t("taskCard.xpEarned")}: {userProgress?.xp_earned || 0}</div> : null}
        {isLocked ? <div>{t("taskCard.unlockHint")}</div> : null}
      </div>

      <div>
        {isLocked ? (
          <button className="secondary-button" type="button" disabled>
            {t("common.locked")}
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onOpen}>
            {isCompleted ? t("common.redo") : t("common.start")}
          </button>
        )}
      </div>
    </article>
  );
}
