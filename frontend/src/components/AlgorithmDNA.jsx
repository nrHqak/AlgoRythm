import { useEffect, useMemo, useState } from "react";

const AXES = [
  "Loop Boundaries",
  "Swap Accuracy",
  "Condition Logic",
  "Search Precision",
  "Sorting Mastery",
  "Error Recovery",
];

const TIPS = {
  "Loop Boundaries": "Practice checking array boundaries — try arr[i-1] before arr[i].",
  "Swap Accuracy": "Focus on swap patterns — make sure both sides of the assignment are correct.",
  "Condition Logic": "Pay attention to comparison operators — is it > or >= ?",
  "Search Precision": "Work through binary search step by step with small arrays first.",
  "Sorting Mastery": "Try running your sort on [5,4,3,2,1] and trace each pass manually.",
  "Error Recovery": "When you hit an error, read the trace backwards from the error line.",
};

function pointAt(angle, radius) {
  return {
    x: 150 + radius * Math.cos(angle),
    y: 150 + radius * Math.sin(angle),
  };
}

function polygonPoints(scores, scale = 1) {
  return AXES.map((axis, index) => {
    const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
    const radius = ((scores?.[axis] || 0) / 100) * 100 * scale;
    const point = pointAt(angle, radius);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

export function AlgorithmDNA({ dna, loading }) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (!dna || loading || dna.total_sessions < 3) {
      setAnimateIn(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setAnimateIn(true));
    return () => window.cancelAnimationFrame(frame);
  }, [dna, loading]);

  const backgroundPolygons = useMemo(
    () =>
      [0.33, 0.66, 1].map((ratio) =>
        AXES.map((_, index) => {
          const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
          const point = pointAt(angle, 100 * ratio);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        }).join(" ")
      ),
    []
  );

  const hasUnlocked = dna && dna.total_sessions >= 3;
  const polygon = hasUnlocked ? polygonPoints(dna.scores, animateIn ? 1 : 0) : "";

  return (
    <section className="panel dna-panel">
      <div className="panel-header">
        <div>
          <h2>Algorithm DNA</h2>
          <p>{dna ? `Based on your last ${dna.total_sessions} sessions` : "Based on your recent practice sessions"}</p>
        </div>
      </div>

      {loading ? (
        <div className="dna-skeleton">
          <div className="skeleton-radar" />
        </div>
      ) : !hasUnlocked ? (
        <div className="dna-empty">
          <svg viewBox="0 0 300 300" className="dna-chart-svg dna-chart-svg--muted" aria-hidden="true">
            {backgroundPolygons.map((points, index) => (
              <polygon key={points} points={points} className={`dna-grid-ring ring-${index + 1}`} />
            ))}
            {AXES.map((axis, index) => {
              const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
              const tip = pointAt(angle, 100);
              return <line key={axis} x1="150" y1="150" x2={tip.x} y2={tip.y} className="dna-axis-line" />;
            })}
          </svg>
          <div className="empty-state dna-placeholder-copy">
            Run at least 3 algorithms to unlock your DNA profile
          </div>
        </div>
      ) : (
        <>
          <div className="dna-visual">
            <svg viewBox="0 0 300 300" className="dna-chart-svg" aria-label="Algorithm DNA radar chart">
              {backgroundPolygons.map((points, index) => (
                <polygon key={points} points={points} className={`dna-grid-ring ring-${index + 1}`} />
              ))}

              {AXES.map((axis, index) => {
                const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
                const tip = pointAt(angle, 100);
                const labelTip = pointAt(angle, 124);
                const lines = axis.split(" ");
                return (
                  <g key={axis}>
                    <line x1="150" y1="150" x2={tip.x} y2={tip.y} className="dna-axis-line" />
                    <text x={labelTip.x} y={labelTip.y} textAnchor="middle" className="dna-axis-label">
                      {lines.length > 1 ? (
                        <>
                          <tspan x={labelTip.x} dy="0">
                            {lines.slice(0, Math.ceil(lines.length / 2)).join(" ")}
                          </tspan>
                          <tspan x={labelTip.x} dy="12">
                            {lines.slice(Math.ceil(lines.length / 2)).join(" ")}
                          </tspan>
                        </>
                      ) : (
                        axis
                      )}
                    </text>
                  </g>
                );
              })}

              <polygon points={polygon} className="dna-polygon" />

              {AXES.map((axis, index) => {
                const angle = (index / AXES.length) * Math.PI * 2 - Math.PI / 2;
                const radius = ((dna.scores[axis] || 0) / 100) * 100 * (animateIn ? 1 : 0);
                const point = pointAt(angle, radius);
                return <circle key={axis} cx={point.x} cy={point.y} r="4" className="dna-point" />;
              })}
            </svg>
          </div>

          <div className="dna-insights">
            <span className="pill dna-pill dna-pill--weak">{`⚠ Weak: ${dna.weak_spot}`}</span>
            <span className="pill dna-pill dna-pill--strong">{`✓ Strong: ${dna.strong_spot}`}</span>
          </div>
          <p className="helper-text dna-tip">{TIPS[dna.weak_spot]}</p>
        </>
      )}
    </section>
  );
}
