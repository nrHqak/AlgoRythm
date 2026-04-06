import { useLocale } from "../hooks/useLocale.jsx";

const EVENT_COLORS = {
  compare: "#EF9F27",
  swap: "#1D9E75",
  error: "#E24B4A",
  step: "#888780",
};

export function VisualCanvas({ step, totalSteps }) {
  const { t } = useLocale();
  const values = Array.isArray(step?.array) ? step.array : [];

  if (!values.length) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{t("playground.visualizer")}</h2>
            <p>{t("playground.visualizerSubtitle")}</p>
          </div>
        </div>
        <div className="empty-state">{t("playground.arrayEmpty")}</div>
        <div className="step-label">{t("playground.stepOf")} 0 / {totalSteps || 0}</div>
      </section>
    );
  }

  const width = 660;
  const height = 260;
  const gap = 10;
  const maxValue = Math.max(...values.map((value) => Math.abs(Number(value) || 0)), 1);
  const barWidth = Math.max((width - gap * (values.length - 1)) / values.length, 18);
  const highlightSet = new Set(
    Array.isArray(step?.highlights) && step.highlights.length > 0
      ? step.highlights
      : step?.event === "error"
        ? values.map((_, index) => index)
        : []
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{t("playground.visualizer")}</h2>
          <p>{t("playground.visualizerSubtitle")}</p>
        </div>
      </div>

      <div className="chart-shell">
        <svg className="chart-svg" viewBox={`0 0 ${width} ${height + 42}`} preserveAspectRatio="none">
          {values.map((value, index) => {
            const normalized = Math.abs(Number(value) || 0) / maxValue;
            const scaledHeight = Math.max(8, Math.min(height - 20, normalized * (height - 20)));
            const x = index * (barWidth + gap);
            const y = height - scaledHeight;
            const isHighlighted = highlightSet.has(index);
            const fill = isHighlighted ? EVENT_COLORS[step?.event || "step"] : "#888780";

            return (
              <g key={`${index}-${value}`}>
                <rect className="chart-bar" x={x} y={y} width={barWidth} height={scaledHeight} rx="8" fill={fill} />
                <text className="chart-value" x={x + barWidth / 2} y={height + 24} textAnchor="middle">
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="step-label">
        {t("playground.stepOf")} {totalSteps > 0 ? (step?.step ?? 0) + 1 : 0} / {totalSteps}
      </div>
    </section>
  );
}
