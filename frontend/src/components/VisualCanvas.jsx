import { useLocale } from "../hooks/useLocale.jsx";

export function VisualCanvas({ step, totalSteps }) {
  const { t } = useLocale();
  const values = Array.isArray(step?.array) ? step.array : [];
  const event = step?.event || "idle";
  const stepNumber = totalSteps > 0 ? (step?.step ?? 0) + 1 : 0;

  if (!values.length) {
    return (
      <section className="panel visual-canvas-panel">
        <div className="panel-header">
          <div>
            <h2>{t("playground.visualizer")}</h2>
            <p>{t("playground.visualizerSubtitle")}</p>
          </div>
          <div className="trace-readouts">
            <span>STEP / 000 / {String(totalSteps || 0).padStart(3, "0")}</span>
            <strong className="event-readout is-idle">EVENT / IDLE</strong>
          </div>
        </div>
        <div className="empty-state">{t("playground.arrayEmpty")}</div>
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
    <section className="panel visual-canvas-panel">
      <div className="panel-header">
        <div>
          <h2>{t("playground.visualizer")}</h2>
          <p>{t("playground.visualizerSubtitle")}</p>
        </div>
        <div className="trace-readouts">
          <span>STEP / {String(stepNumber).padStart(3, "0")} / {String(totalSteps).padStart(3, "0")}</span>
          <strong className={`event-readout is-${event}`}>EVENT / {event.toUpperCase()}</strong>
        </div>
      </div>

      <div className="chart-shell">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height + 42}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${event} event at step ${stepNumber} of ${totalSteps}`}
        >
          {values.map((value, index) => {
            const normalized = Math.abs(Number(value) || 0) / maxValue;
            const scaledHeight = Math.max(8, Math.min(height - 20, normalized * (height - 20)));
            const x = index * (barWidth + gap);
            const y = height - scaledHeight;
            const isHighlighted = highlightSet.has(index);

            return (
              <g key={`${index}-${value}`}>
                <rect
                  className={`chart-bar${isHighlighted ? ` is-highlighted is-${event}` : ""}`}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={scaledHeight}
                />
                <text className="chart-value" x={x + barWidth / 2} y={height + 24} textAnchor="middle">
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
