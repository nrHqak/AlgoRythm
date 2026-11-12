import { loadPyodide, version } from "pyodide";

import tracerSource from "./tracer.py?raw";
import runnerSource from "./browser_trace.py?raw";

// Only this module imports Pyodide. All Python, including tracer bootstrap,
// runs inside a module Worker. Bundle the canonical tracer to prevent drift.
const runtime = loadPyodide({
  indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/`,
  stdout: () => {},
  stderr: () => {},
}).then((pyodide) => {
  const globals = pyodide.runPython(`
import sys, types
_browser_tracer = types.ModuleType("tracer")
sys.modules["tracer"] = _browser_tracer
_browser_tracer.__dict__
`);
  try {
    pyodide.runPython(`${tracerSource}\n${runnerSource}`, { globals });
    return globals.get("execute_trace");
  } finally {
    globals.destroy(); // The function retains its Python namespace.
  }
});

runtime.then(
  () => self.postMessage({ type: "ready" }),
  () => self.postMessage({
    type: "error", requestId: null,
    error: { type: "InitializationError", message: "Unable to load Python runtime/tracer." },
  }),
);

self.onmessage = async ({ data }) => {
  if (data?.type !== "execute" || typeof data.requestId !== "string" || !data.requestId) return;
  const { requestId, code, arrayVar, maxSteps, mode = "trace" } = data;
  try {
    if (typeof code !== "string" || typeof arrayVar !== "string" || !arrayVar || !Number.isInteger(maxSteps) || maxSteps < 1 ||
        !["trace", "count"].includes(mode) || maxSteps > (mode === "count" ? 25000 : 300)) {
      throw new TypeError("Invalid execution request.");
    }
    const executeTrace = await runtime;
    const result = JSON.parse(mode === "trace" ? executeTrace(code, arrayVar, maxSteps) : executeTrace(code, arrayVar, maxSteps, mode));
    // Python compile/runtime errors are canonical trace results. The error
    // envelope is reserved for worker/bootstrap/transport failures.
    self.postMessage({ type: "result", requestId, result });
  } catch (error) {
    self.postMessage({
      type: "error", requestId,
      error: { type: error.name || "RuntimeError", message: error.message || "Python execution failed." },
    });
  }
};
