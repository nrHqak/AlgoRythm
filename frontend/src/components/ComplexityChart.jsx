import { useEffect, useMemo, useState } from "react";

const COLORS = {
  "O(log n)": "#1D9E75",
  "O(n)": "#639922",
  "O(n log n)": "#BA7517",
  "O(n²)": "#D85A30",
  "O(n³)": "#E24B4A",
  "O(√n)": "#4FC7B3",
};

const EXPLANATIONS = {
  "O(log n)": "Your algorithm is very efficient — doubling the input barely increases work.",
  "O(n)": "Linear complexity — work grows proportionally with input size. Good!",
  "O(n log n)": "Near-optimal for sorting. This is as good as comparison sorts get.",
  "O(n²)": "Quadratic complexity — on large inputs this will be slow. Try to reduce nested loops.",
  "O(n³)": "Cubic complexity — avoid this for large datasets.",
  "O(√n)": "Sublinear growth — work rises slowly, which usually means very efficient scaling.",
};

function buildPath(points) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function ComplexityChart({ complexityData, isLoading }) {
  const [pathVisible, setPathVisible] = useState(false);

  useEffect(() => {
    if (!complexityData || isLoading) {
      setPathVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setPathVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [complexityData, isLoading]);

  const chart = useMemo(() => {
    if (!complexityData?.sizes?.length || !complexityData?.steps?.length) {
      return null;
    }

    const padding = { top: 18, right: 20, bottom: 28, left: 26 };
    const width = 400;
    const height = 180;
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;
    const maxStep = Math.max(...complexityData.steps, 1);

    const points = complexityData.sizes.map((size, index) => {
      const x = padding.left + (index / Math.max(1, complexityData.sizes.length - 1)) * usableWidth;
      const y = padding.top + usableHeight - (complexityData.steps[index] / maxStep) * usableHeight;
      return {
        x,
        y,
        size,
        steps: complexityData.steps[index],
      };
    });

    return {
      points,
      path: buildPath(points),
      width,
      height,
      padding,
      maxStep,
    };
  }, [complexityData]);

  if (!isLoading && !complexityData) {
    return null;
  }

  const color = COLORS[complexityData?.complexity] || "#7BFFE6";
  const explanation = EXPLANATIONS[complexityData?.complexity] || "Run more traces to understand how your work scales.";

  return (
    <section className="panel complexity-panel">
      <div className="panel-header">
        <div>
          <h2>Complexity Analysis</h2>
          <p>How your algorithm scales as the input grows.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="complexity-skeleton">
          <div className="skeleton-title" />
          <div className="skeleton-chart" />
          <div className="helper-text">Analyzing complexity...</div>
        </div>
      ) : complexityData?.error ? (
        <div className="empty-state complexity-empty">Not enough data to estimate complexity yet.</div>
      ) : (
        <>
          <div className="complexity-summary">
            <strong style={{ color }}>{complexityData?.complexity || "Unknown"}</strong>
            <span>{complexityData?.label || "Growth profile unavailable."}</span>
          </div>

          {chart ? (
            <div className="complexity-chart-shell">
              <svg viewBox="0 0 400 180" className="complexity-chart-svg" aria-label="Complexity chart">
                <line x1="26" y1="152" x2="380" y2="152" className="complexity-axis" />
                <line x1="26" y1="18" x2="26" y2="152" className="complexity-axis" />

                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = 18 + (1 - ratio) * 134;
                  return (
                    <g key={ratio}>
                      <line x1="26" y1={y} x2="380" y2={y} className="complexity-grid-line" />
                      <text x="8" y={y + 4} className="complexity-tick">
                        {Math.round(chart.maxStep * ratio)}
                      </text>
                    </g>
                  );
                })}

                <path
                  d={chart.path}
                  className={`complexity-line${pathVisible ? " is-visible" : ""}`}
                  style={{ stroke: color }}
                />

                {chart.points.map((point) => (
                  <g key={point.size}>
                    <circle cx={point.x} cy={point.y} r="4.5" fill={color}>
                      <title>{`n=${point.size} → ${point.steps} steps`}</title>
                    </circle>
                    <text x={point.x} y="170" textAnchor="middle" className="complexity-tick">
                      {point.size}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          ) : null}

          <div className="complexity-footer">
            <span className="pill">{`Fit: ${Math.round((complexityData?.confidence || 0) * 100)}%`}</span>
            <p>{explanation}</p>
          </div>
        </>
      )}
    </section>
  );
}
