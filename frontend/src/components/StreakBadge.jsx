import { useLocale } from "../hooks/useLocale.jsx";

export function StreakBadge({ streak = 0 }) {
  const { t } = useLocale();
  const className = `streak-badge${streak === 0 ? " is-zero" : ""}${streak >= 3 ? " is-pulse" : ""}`;

  return (
    <div className={className}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M13.5 2c1.2 4-1.7 5.3-.9 8 1 3.1 5.4 2.7 5.4 7 0 3.3-2.5 5-6 5s-6-2.2-6-5.6c0-4.6 4.3-6.6 5.2-10.4.3-1.4.2-2.4.3-4z"
          fill="currentColor"
        />
      </svg>
      <span>{streak} {t("streak.days")}</span>
    </div>
  );
}
