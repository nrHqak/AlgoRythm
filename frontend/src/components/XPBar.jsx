import { getLevelMeta } from "../hooks/useProfile.jsx";
import { useLocale } from "../hooks/useLocale.jsx";

export function XPBar({ xp = 0 }) {
  const { t } = useLocale();
  const levelMeta = getLevelMeta(xp);
  const levelSpan = Number.isFinite(levelMeta.maxXp) ? levelMeta.maxXp - levelMeta.minXp + 1 : 500;
  const levelXp = xp - levelMeta.minXp;
  const maxLabel = Number.isFinite(levelMeta.maxXp) ? levelMeta.maxXp - levelMeta.minXp + 1 : "∞";
  const progress = Number.isFinite(levelMeta.maxXp) ? Math.min((levelXp / levelSpan) * 100, 100) : 100;

  return (
    <div className="xp-bar">
      <div className="progress-copy">
        {t("xp.level")} {levelMeta.level} · {levelXp} / {maxLabel} XP
      </div>
      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
