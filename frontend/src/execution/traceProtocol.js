/** Shared input boundary; the server's existing maximum remains 300. */
export function executionOptions({ code, arrayVar = "arr", maxSteps = 300 } = {}) {
  if (typeof code !== "string" || !code || typeof arrayVar !== "string" || !arrayVar ||
      !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 300) {
    throw new TypeError("Execution requires code, an array variable, and maxSteps between 1 and 300.");
  }
  return { code, arrayVar, maxSteps };
}

export function emptyTrace(error = null) {
  return { trace_version: 1, steps: [], error, total_steps: 0, truncated: false };
}

export function requireTrace(result) {
  if (result?.trace_version !== 1 || !Array.isArray(result.steps) ||
      result.total_steps !== result.steps.length || typeof result.truncated !== "boolean" ||
      !(result.error === null || (result.error && typeof result.error === "object"))) {
    throw new TypeError("Execution engine returned an invalid Trace Protocol v1 result.");
  }
  return result; // Preserve enrichment and diagnostics, outside the core protocol.
}

/** A worker timeout rejects its request; visual consumers receive its neutral trace. */
export async function executeTrace(engine, options) {
  try {
    return requireTrace(await engine.execute(options));
  } catch (error) {
    if (error.name === "timeout" && error.trace) return requireTrace(error.trace);
    throw error;
  }
}
