import { BrowserEngine } from "../browserEngine";
import { executeTrace, requireTrace } from "../traceProtocol";

/** Meaningful canonical fields only; classifier/diagnostic metadata is separate. */
export function canonicalTrace(result) {
  requireTrace(result);
  return {
    trace_version: result.trace_version,
    total_steps: result.total_steps,
    truncated: result.truncated,
    error: result.error,
    steps: result.steps.map(({ step, line, event, array, highlights, locals, error }) => (
      { step, line, event, array, highlights, locals, error }
    )),
  };
}

export function traceDifferences(expected, browser) {
  const differences = [];
  function compare(left, right, path) {
    if (differences.length >= 20) return;
    if (left === right) return;
    if (left && right && typeof left === "object" && typeof right === "object" &&
        Array.isArray(left) === Array.isArray(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      if (Array.isArray(left) && left.length !== right.length) differences.push(`${path}.length: ${left.length} vs ${right.length}`);
      for (const key of keys) compare(left[key], right[key], `${path}.${key}`);
    } else {
      differences.push(`${path}: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
    }
  }
  compare(canonicalTrace(expected), canonicalTrace(browser), "trace");
  return differences;
}

export async function verifyBrowser({ cases, browser = new BrowserEngine() }) {
  const rows = [];
  try {
    await browser.initialize();
    for (const { name, expected, ...options } of cases) {
      const browserTrace = await executeTrace(browser, options);
      const differences = traceDifferences(expected, browserTrace);
      rows.push({ name, status: differences.length ? "FAIL" : "PASS", differences,
        totalSteps: browserTrace.total_steps, finalArray: browserTrace.steps.at(-1)?.array ?? [],
        error: browserTrace.error, truncated: browserTrace.truncated });
    }
    return rows;
  } finally {
    browser.terminate();
  }
}
