import { useEffect } from "react";

export function AchievementToast({ toast, onDone }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(), 4000);
    return () => window.clearTimeout(timer);
  }, [toast.toastId, onDone]);

  return (
    <div className="achievement-toast">
      <div className="achievement-toast-row">
        <div className="toast-icon">{toast.icon || "🏆"}</div>
        <div>
          <div className="achievement-title">{toast.title}</div>
          <div className="meta-text">{toast.description}</div>
          <div className="toast-pulse">+{toast.xp_reward || 0} XP</div>
        </div>
      </div>
    </div>
  );
}
