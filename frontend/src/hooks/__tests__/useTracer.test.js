import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useTracer } from "../useTracer";
import { BrowserEngine } from "../../execution/browserEngine";
import { emptyTrace } from "../../execution/traceProtocol";

const classify = async () => ({ algorithm_type: "unknown", algorithm_confidence: 0 });
function renderExecution(execute) {
  const engine = new BrowserEngine({ manager: { executionTimeoutMs: 2000, execute, initialize: async () => {}, getStatus: () => "ready" } });
  return renderHook(() => useTracer({ engine, classify }));
}

it("commits a browser trace with asynchronous metadata", async () => {
  const trace = { ...emptyTrace(), steps: [{ step: 0 }], total_steps: 1 };
  const { result } = renderExecution(vi.fn().mockResolvedValue(trace));
  let returned;
  await act(async () => { returned = await result.current.analyzeCode("arr = [1]", "arr"); });
  expect(returned).toEqual(trace);
  expect(result.current.traceData).toMatchObject({ ...trace, algorithm_type: "unknown" });
  expect(result.current.requestError).toBe("");
});

it("clears stale trace after a worker infrastructure failure", async () => {
  const execute = vi.fn().mockResolvedValueOnce({ ...emptyTrace(), steps: [{ step: 0 }], total_steps: 1 }).mockRejectedValueOnce(new Error("Worker failed"));
  const { result } = renderExecution(execute);
  await act(async () => { await result.current.analyzeCode("arr = [1]", "arr"); });
  await act(async () => { await result.current.analyzeCode("arr = [1]", "arr"); });
  expect(result.current.traceData.steps).toEqual([]);
  expect(result.current.traceData.trace_version).toBeNull();
  expect(result.current.requestError).toBe("Worker failed");
  expect(result.current.isLoading).toBe(false);
});

it("displays canonical timeout errors without an infrastructure error", async () => {
  const trace = emptyTrace({ type: "timeout", message: "Execution exceeded 2 seconds.", line: 1 });
  const error = Object.assign(new Error("timeout"), { name: "timeout", trace });
  const { result } = renderExecution(vi.fn().mockRejectedValue(error));
  await act(async () => { await result.current.analyzeCode("while True: pass", "arr"); });
  expect(result.current.traceData.error).toEqual(trace.error);
  expect(result.current.requestError).toBe("");
});
