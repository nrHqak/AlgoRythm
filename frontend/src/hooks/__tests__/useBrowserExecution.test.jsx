import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { usePythonRuntimePrewarm } from "../usePythonRuntimePrewarm";
import { useTracer } from "../useTracer";
import { emptyTrace } from "../../execution/traceProtocol";

let workers;
function mockWorkers() {
  workers = [];
  vi.stubGlobal("Worker", class {
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { workers.push(this); }
  });
}
function usePlaygroundExecution() {
  const runtimeRef = usePythonRuntimePrewarm();
  return useTracer({ runtimeRef });
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("browser default executes through the prewarmed worker and only fetches classification", async () => {
  mockWorkers();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ algorithm_type: "bubble_sort", algorithm_confidence: 0.9 }) });
  vi.stubGlobal("fetch", fetchMock);
  const { result, unmount } = renderHook(usePlaygroundExecution);
  expect(workers).toHaveLength(1);
  await act(async () => { workers[0].onmessage({ data: { type: "ready" } }); });
  await act(async () => {
    const promise = result.current.analyzeCode("arr = [1]", "arr");
    await Promise.resolve();
    const { requestId } = workers[0].postMessage.mock.calls[0][0];
    workers[0].onmessage({ data: { type: "result", requestId, result: emptyTrace() } });
    await promise;
  });
  expect(result.current.traceData.trace_version).toBe(1);
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls[0][0]).toBe("/classify");
  unmount();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});

it("StrictMode retires the earlier worker and execution uses the replacement", async () => {
  mockWorkers();
  const { result, unmount } = renderHook(usePlaygroundExecution, { wrapper: StrictMode });
  expect(workers).toHaveLength(2);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  await act(async () => { workers[1].onmessage({ data: { type: "ready" } }); });
  await act(async () => {
    const promise = result.current.analyzeCode("arr = [1]", "arr");
    await Promise.resolve();
    const { requestId } = workers[1].postMessage.mock.calls[0][0];
    workers[1].onmessage({ data: { type: "result", requestId, result: emptyTrace() } });
    await promise;
  });
  expect(workers[0].postMessage).not.toHaveBeenCalled();
  unmount();
  expect(workers[1].terminate).toHaveBeenCalledOnce();
});

it("initialization failure blocks execution, sends no HTTP request, and Retry reuses the manager", async () => {
  mockWorkers();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ algorithm_type: "unknown", algorithm_confidence: 0 }) });
  vi.stubGlobal("fetch", fetchMock);
  const { result, unmount } = renderHook(usePlaygroundExecution);
  await act(async () => { workers[0].onerror({}); });
  expect(result.current.runtimeStatus).toBe("error");
  expect(result.current.canRun).toBe(false);
  await expect(result.current.analyzeCode("arr = [1]", "arr")).resolves.toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  let retry;
  await act(async () => { retry = result.current.retryRuntime(); result.current.retryRuntime(); });
  expect(workers).toHaveLength(2);
  expect(result.current.runtimeStatus).toBe("loading");
  await act(async () => { workers[1].onmessage({ data: { type: "ready" } }); await retry; });
  expect(result.current.canRun).toBe(true);
  await act(async () => {
    const pending = result.current.analyzeCode("arr = [1]", "arr");
    await Promise.resolve();
    const { requestId } = workers[1].postMessage.mock.calls[0][0];
    workers[1].onmessage({ data: { type: "result", requestId, result: emptyTrace() } });
    await pending;
  });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/classify"]);
  unmount();
});

it("failed Retry remains unavailable and unmount retires pending initialization", async () => {
  mockWorkers();
  const { result, unmount } = renderHook(usePlaygroundExecution);
  await act(async () => { workers[0].onerror({}); });
  let retry;
  await act(async () => { retry = result.current.retryRuntime(); });
  await act(async () => { workers[1].onerror({}); await retry; });
  expect(result.current.runtimeStatus).toBe("error");
  await act(async () => { retry = result.current.retryRuntime(); });
  unmount();
  await retry;
  expect(workers[2].terminate).toHaveBeenCalledOnce();
});

it("browser timeout renders the same trace error and recreates its worker", async () => {
  vi.useFakeTimers();
  mockWorkers();
  const { result, unmount } = renderHook(usePlaygroundExecution);
  await act(async () => { workers[0].onmessage({ data: { type: "ready" } }); });
  await act(async () => {
    const promise = result.current.analyzeCode("while True: pass", "arr");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
    await promise;
  });
  expect(result.current.traceData.error).toEqual({ type: "timeout", message: "Execution exceeded 2 seconds.", line: 1 });
  expect(result.current.requestError).toBe("");
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);
  expect(result.current.runtimeStatus).toBe("restarting");
  expect(result.current.canRun).toBe(false);
  await act(async () => { workers[1].onmessage({ data: { type: "ready" } }); });
  expect(result.current.canRun).toBe(true);
  await act(async () => {
    const promise = result.current.analyzeCode("arr = [1]", "arr");
    await Promise.resolve();
    const { requestId } = workers[1].postMessage.mock.calls[0][0];
    workers[1].onmessage({ data: { type: "result", requestId, result: emptyTrace() } });
    await promise;
  });
  expect(result.current.traceData.error).toBeNull();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not silently retry a synchronously failed prewarm", async () => {
  const factory = vi.fn(function () { throw new Error("Worker blocked"); });
  vi.stubGlobal("Worker", factory);
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(usePlaygroundExecution);
  await act(async () => {});
  expect(factory).toHaveBeenCalledOnce();
  expect(result.current.runtimeStatus).toBe("error");
  expect(result.current.canRun).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
