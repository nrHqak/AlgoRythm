export const COMPLEXITY_SIZES = Object.freeze([5, 10, 20, 40, 80]);
export const COMPLEXITY_MAX_STEPS = 25000;
const PROFILES = [
  { feature: (n) => Math.sqrt(n), complexity: "O(√n)", label: "Sublinear — work grows very gently." },
  { feature: (n) => Math.log(Math.max(n, 2)), complexity: "O(log n)", label: "Logarithmic — doubling input adds only a little extra work." },
  { feature: (n) => n, complexity: "O(n)", label: "Linear — work grows proportionally with input size." },
  { feature: (n) => n * Math.log(Math.max(n, 2)), complexity: "O(n log n)", label: "Near-optimal for sorting — a strong result for comparison-based algorithms." },
  { feature: (n) => n ** 2, complexity: "O(n²)", label: "Quadratic — typical for nested loops." },
  { feature: (n) => n ** 3, complexity: "O(n³)", label: "Cubic — very expensive on larger inputs." },
];

// Preserve the legacy first-list-literal substitution, descending input,
// least-squares scale (no intercept), SSE selection and bounded R² confidence.
export function complexitySource(code, size) {
  const array = Array.from({ length: size }, (_, index) => size - index);
  return code.replace(/(?<![\p{L}\p{N}_])([\p{L}\p{N}_]+)(?![\p{L}\p{N}_])\s*=\s*\[[^\]]*\]/mu, (_match, name) => `${name} = [${array.join(", ")}]`);
}

export function fitComplexity(sizes, steps) {
  const valid = sizes.map((n, i) => [n, steps[i]]).filter(([, count]) => count > 0);
  if (valid.length < 3) return { error: "not enough data", sizes: [...sizes], steps: [...steps] };
  const mean = valid.reduce((sum, [, count]) => sum + count, 0) / valid.length;
  const sst = valid.reduce((sum, [, count]) => sum + (count - mean) ** 2, 0);
  const fits = PROFILES.map((profile) => {
    const denominator = valid.reduce((sum, [n]) => sum + profile.feature(n) ** 2, 0);
    const scale = denominator ? valid.reduce((sum, [n, count]) => sum + profile.feature(n) * count, 0) / denominator : 0;
    const sse = valid.reduce((sum, [n, count]) => sum + (count - scale * profile.feature(n)) ** 2, 0);
    const rSquared = sst === 0 ? 1 : Math.max(0, Math.min(1, 1 - sse / sst));
    return { complexity: profile.complexity, label: profile.label, confidence: Math.round(rSquared * 1000) / 1000, sse };
  });
  const best = fits.reduce((best, fit) => fit.sse < best.sse ? fit : best);
  return { sizes: [...sizes], steps: [...steps], complexity: best.complexity, label: best.label, confidence: best.confidence };
}

function checkCancellation(signal) {
  if (signal?.aborted) throw new DOMException("Complexity analysis cancelled.", "AbortError");
}

export class ComplexityAnalysis {
  constructor(engine, { sizes = COMPLEXITY_SIZES, maxSteps = COMPLEXITY_MAX_STEPS, cacheLimit = 20 } = {}) {
    if (!Array.isArray(sizes) || sizes.length < 3 || sizes.length > 5 ||
        !sizes.every((size) => Number.isInteger(size) && size > 0 && size <= 80) ||
        !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > COMPLEXITY_MAX_STEPS ||
        !Number.isInteger(cacheLimit) || cacheLimit < 1 || cacheLimit > 20) {
      throw new TypeError("Invalid complexity sampling parameters.");
    }
    this.engine = engine;
    this.sizes = [...sizes];
    this.maxSteps = maxSteps;
    this.cacheLimit = cacheLimit;
    this.cache = new Map();
  }

  key(code, arrayVar) {
    return JSON.stringify(["complexity-v1", code, arrayVar, this.sizes, this.maxSteps]);
  }

  async analyze(code, arrayVar, { signal } = {}) {
    checkCancellation(signal);
    const key = this.key(code, arrayVar);
    if (this.cache.has(key)) return this.cache.get(key);
    const steps = [];
    for (const size of this.sizes) {
      checkCancellation(signal);
      const measurement = await this.engine.count({ code: complexitySource(code, size), arrayVar, maxSteps: this.maxSteps, signal });
      checkCancellation(signal);
      // A capped sample is censored data, not a valid growth measurement.
      if (measurement.truncated) throw Object.assign(new Error("Complexity sample exceeded the step limit."), { code: "step_limit" });
      steps.push(measurement.error ? 0 : measurement.count);
    }
    const result = fitComplexity(this.sizes, steps);
    if (result.error) throw Object.assign(new Error("Not enough data to estimate complexity."), { code: "insufficient" });
    Object.freeze(result.sizes); Object.freeze(result.steps); Object.freeze(result);
    if (this.cache.size >= this.cacheLimit) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, result);
    return result;
  }
}
