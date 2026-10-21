import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { loadPyodide } = vi.hoisted(() => ({ loadPyodide: vi.fn() }));
vi.mock("pyodide", () => ({ loadPyodide, version: "314.0.7" }));

let scope;
let pyodide;
let globals;
let initialize;
let failInitialization;
let executeTrace;
const trace = { trace_version: 1, steps: [], error: null, total_steps: 0, truncated: false };

beforeEach(() => {
  vi.resetModules();
  scope = { postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  executeTrace = vi.fn().mockReturnValue(JSON.stringify(trace));
  globals = { destroy: vi.fn(), get: vi.fn().mockReturnValue(executeTrace) };
  pyodide = { runPython: vi.fn().mockReturnValueOnce(globals) };
  loadPyodide.mockReset().mockReturnValue(new Promise((resolve, reject) => {
    initialize = () => resolve(pyodide);
    failInitialization = reject;
  }));
});

afterEach(() => { vi.unstubAllGlobals(); });

async function flush() { await Promise.resolve(); await Promise.resolve(); }

it("loads matching CDN assets, bootstraps the canonical tracer, and then announces ready", async () => {
  await import("../python.worker.js");
  expect(loadPyodide).toHaveBeenCalledWith({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/",
    stdout: expect.any(Function), stderr: expect.any(Function),
  });
  expect(scope.postMessage).not.toHaveBeenCalled();
  initialize();
  await flush();
  expect(pyodide.runPython).toHaveBeenCalledWith(expect.stringContaining("class AlgorithmTracer:"), { globals });
  expect(pyodide.runPython).toHaveBeenCalledWith(expect.stringContaining("def execute_trace("), { globals });
  expect(globals.get).toHaveBeenCalledWith("execute_trace");
  expect(globals.destroy).toHaveBeenCalledOnce();
  expect(scope.postMessage).toHaveBeenCalledWith({ type: "ready" });
});

it("passes source as an argument and returns neutral JSON trace data", async () => {
  await import("../python.worker.js");
  initialize();
  await scope.onmessage({ data: { type: "execute", requestId: "test-1", code: 'arr = ["quotes\\n"]', arrayVar: "arr", maxSteps: 4 } });
  expect(executeTrace).toHaveBeenCalledWith('arr = ["quotes\\n"]', "arr", 4);
  expect(scope.postMessage).toHaveBeenCalledWith({ type: "result", requestId: "test-1", result: trace });
});

it("returns Python runtime errors inside canonical result envelopes", async () => {
  await import("../python.worker.js");
  initialize();
  const errorTrace = { ...trace, error: { type: "IndexError", message: "list index out of range", line: 2 } };
  executeTrace.mockReturnValue(JSON.stringify(errorTrace));
  await scope.onmessage({ data: { type: "execute", requestId: "bad", code: "arr[99]", arrayVar: "arr", maxSteps: 300 } });
  expect(scope.postMessage).toHaveBeenCalledWith({ type: "result", requestId: "bad", result: errorTrace });
});

it("uses an error envelope for bridge failures", async () => {
  await import("../python.worker.js");
  initialize();
  executeTrace.mockImplementation(() => { throw new Error("Bridge failed"); });
  await scope.onmessage({ data: { type: "execute", requestId: "bad", code: "pass", arrayVar: "arr", maxSteps: 300 } });
  expect(scope.postMessage).toHaveBeenCalledWith({ type: "error", requestId: "bad", error: { type: "Error", message: "Bridge failed" } });
});

it("reports initialization failure without a fabricated execution ID", async () => {
  await import("../python.worker.js");
  failInitialization(new Error("Network unavailable"));
  await flush();
  expect(scope.postMessage).toHaveBeenCalledWith({
    type: "error", requestId: null,
    error: { type: "InitializationError", message: "Unable to load Python runtime/tracer." },
  });
});

it("releases bootstrap proxies even if tracer initialization fails", async () => {
  await import("../python.worker.js");
  pyodide.runPython.mockImplementationOnce(() => { throw new Error("Bad bootstrap"); });
  initialize();
  await flush();
  expect(globals.destroy).toHaveBeenCalledOnce();
  expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "error", requestId: null }));
});

it("ignores messages without request IDs and rejects malformed execution payloads", async () => {
  await import("../python.worker.js");
  initialize();
  await scope.onmessage({ data: { type: "execute", code: "pass" } });
  await scope.onmessage({ data: { type: "execute", requestId: "bad", code: "pass", arrayVar: "arr", maxSteps: 0 } });
  expect(executeTrace).not.toHaveBeenCalled();
  expect(scope.postMessage).toHaveBeenCalledWith({
    type: "error", requestId: "bad", error: { type: "TypeError", message: "Invalid execution request." },
  });
});

it("executes count mode internally without returning a visualization trace", async () => {
  await import("../python.worker.js");
  initialize();
  const counts = { count: 12000, error: null, truncated: false };
  executeTrace.mockReturnValue(JSON.stringify(counts));
  await scope.onmessage({ data: { type: "execute", requestId: "count", code: "arr = [1]", arrayVar: "arr", maxSteps: 25000, mode: "count" } });
  expect(executeTrace).toHaveBeenCalledWith("arr = [1]", "arr", 25000, "count");
  expect(scope.postMessage).toHaveBeenCalledWith({ type: "result", requestId: "count", result: counts });
});
