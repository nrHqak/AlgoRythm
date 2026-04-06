import { useEffect, useState } from "react";

export function useAchievements() {
  const [toasts, setToasts] = useState([]);

  function pushAchievements(achievements) {
    if (!Array.isArray(achievements) || achievements.length === 0) {
      return;
    }

    const nextToasts = achievements.map((achievement, index) => ({
      ...achievement,
      toastId: `${achievement.slug || achievement.id || "achievement"}-${Date.now()}-${index}`,
    }));

    setToasts((previous) => [...previous, ...nextToasts]);
  }

  function removeToast(toastId) {
    setToasts((previous) => previous.filter((toast) => toast.toastId !== toastId));
  }

  useEffect(() => {
    if (toasts.length === 0) {
      return undefined;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.toastId);
      }, 4000)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts]);

  return {
    toasts,
    pushAchievements,
    removeToast,
  };
}
