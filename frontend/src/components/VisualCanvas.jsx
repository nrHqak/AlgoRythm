const EVENT_COLORS = {
  compare: "#EF9F27",
  swap: "#1D9E75",
  error: "#E24B4A",
  step: "#888780",
};

export function VisualCanvas({ step, totalSteps }) {
  const values = Array.isArray(step?.array) ? step.array : [];

  if (!values.length) {
    return (
      <section className="panel visual-panel">
        <div className="panel__header">
          <div>
            <h2>Visualization</h2>
            <p>Trace output appears here as animated bars.</p>
          </div>
        </div>
        <div className="empty-state">Array is empty</div>
        <div className="step-label">Step 0 / {totalSteps || 0}</div>
      </section>
    );
  }

  const maxValue = Math.max(...values.map((value) => Math.abs(Number(value) || 0)), 1);
  const chartHeight = 240;
  const gap = 10;
  const width = 640;
  const barWidth = Math.max((width - gap * (values.length - 1)) / values.length, 18);
  const eventName = step?.event || "step";
  const highlightSet = new Set(
    Array.isArray(step?.highlights) && step.highlights.length > 0
      ? step.highlights
      : eventName === "error"
        ? values.map((_, index) => index)
        : []
  );

  return (
    <section className="panel visual-panel">
      <div className="panel__header">
        <div>
          <h2>Visualization</h2>
          <p>Each step updates the bars with event-specific highlights.</p>
        </div>
      </div>

      <div className="chart-shell">
        <svg className="chart-svg" viewBox={`0 0 ${width} ${chartHeight + 40}`} preserveAspectRatio="none">
          {values.map((value, index) => {
            const normalized = Math.abs(Number(value) || 0) / maxValue;
            const rawHeight = Number(value) * 4;
            const height = Math.max(
              8,
              Math.min(chartHeight - 20, rawHeight > 0 ? rawHeight : normalized * (chartHeight - 20))
            );
            const x = index * (barWidth + gap);
            const y = chartHeight - height;
            const isHighlighted = highlightSet.has(index);
            const fill = isHighlighted ? EVENT_COLORS[eventName] || EVENT_COLORS.step : "#888780";

            return (
              <g key={`${index}-${value}`}>
                <rect
                  className="chart-bar"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx="8"
                  fill={fill}
                />
                <text className="chart-value" x={x + barWidth / 2} y={chartHeight + 20} textAnchor="middle">
                  {value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="step-label">
        Step {(step?.step ?? 0) + 1} / {totalSteps}
      </div>
    </section>
  );
}
