import { useLocale } from "../hooks/useLocale.jsx";

export function LevelBadge({ level, title }) {
  const { t } = useLocale();
  const localizedTitle = t(`levels.${level}`) || title;
  return <div className="level-badge">{t("xp.level")} {level} · {localizedTitle}</div>;
}
