export function TaskCard({ task, status, userProgress, onOpen }) {
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
        <div>Max XP: {task.max_xp}</div>
        {isCompleted ? <div>Best: {userProgress?.best_steps || "—"} steps</div> : null}
        {isCompleted ? <div>XP earned: {userProgress?.xp_earned || 0}</div> : null}
        {isLocked ? <div>Complete previous task to unlock</div> : null}
      </div>

      <div>
        {isLocked ? (
          <button className="secondary-button" type="button" disabled>
            Locked
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onOpen}>
            {isCompleted ? "Redo" : "Start"}
          </button>
        )}
      </div>
    </article>
  );
}
