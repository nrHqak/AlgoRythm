import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTracer } from "../useTracer";
import { emptyTrace } from "../../execution/traceProtocol";

const trace = { ...emptyTrace(), steps: [{ step: 0, array: [2, 1] }], total_steps: 1 };
const metadata = { algorithm_type: "bubble_sort", algorithm_confidence: 0.94 };
function deferred() { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("commits the trace before requesting enrichment and resolves execution while classification is slow", async () => {
  const pending = deferred();
  const engine = { execute: vi.fn().mockResolvedValue(trace) };
  const classify = vi.fn(() => {
    expect(screen.getByTestId("trace").textContent).toBe("1");
    return pending.promise;
  });
  let hook;
  function Consumer() { hook = useTracer({ engine, classify }); return <div data-testid="trace">{hook.traceData.total_steps}</div>; }
  render(<Consumer />);
  let result;
  await act(async () => { result = await hook.analyzeCode("bubble", "arr"); });
  expect(result).toEqual(trace);
  expect(hook.isLoading).toBe(false);
  expect(hook.classificationStatus).toBe("loading");
  expect(classify).toHaveBeenCalledOnce();
  const saving = hook.waitForClassification(result);
  await act(async () => { pending.resolve(metadata); await saving; });
  expect(hook.traceData).toMatchObject({ ...trace, ...metadata });
  await expect(saving).resolves.toMatchObject(metadata);
});

it("keeps a valid trace and supplies unknown session metadata after classification failure", async () => {
  const engine = { execute: vi.fn().mockResolvedValue(trace) };
  const classify = vi.fn().mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useTracer({ engine, classify }));
  let execution;
  await act(async () => { execution = await result.current.analyzeCode("bubble", "arr"); });
  expect(engine.execute).toHaveBeenCalledOnce();
  expect(result.current.requestError).toBe("");
  expect(result.current.traceData).toMatchObject({ ...trace, algorithm_type: "unknown", algorithm_confidence: 0 });
  await expect(result.current.waitForClassification(execution)).resolves.toMatchObject({ algorithm_type: "unknown" });
});

it("aborts stale classification and prevents its late response from changing newer metadata", async () => {
  const old = deferred(); const fresh = deferred();
  const engine = { execute: vi.fn().mockResolvedValue(trace) };
  const classify = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const { result } = renderHook(() => useTracer({ engine, classify }));
  let first;
  await act(async () => { first = await result.current.analyzeCode("first", "arr"); });
  await act(async () => { await result.current.analyzeCode("second", "arr"); });
  expect(classify.mock.calls[0][1].signal.aborted).toBe(true);
  await expect(result.current.waitForClassification(first)).resolves.toMatchObject({ algorithm_type: "unknown" });
  await act(async () => { fresh.resolve({ algorithm_type: "binary_search", algorithm_confidence: 0.87 }); });
  await act(async () => { old.resolve(metadata); });
  expect(result.current.traceData.algorithm_type).toBe("binary_search");
  expect(result.current.traceData.algorithm_confidence).toBe(0.87);
});

it("bounds stalled enrichment without delaying execution or retrying it", async () => {
  vi.useFakeTimers();
  const engine = { execute: vi.fn().mockResolvedValue(trace) };
  const classify = vi.fn(() => new Promise(() => {}));
  const { result, unmount } = renderHook(() => useTracer({ engine, classify }));
  let execution;
  await act(async () => { execution = await result.current.analyzeCode("bubble", "arr"); });
  expect(result.current.traceData.total_steps).toBe(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  await expect(result.current.waitForClassification(execution)).resolves.toMatchObject({ algorithm_type: "unknown" });
  expect(classify.mock.calls[0][1].signal.aborted).toBe(true);
  expect(engine.execute).toHaveBeenCalledOnce();
  unmount(); expect(vi.getTimerCount()).toBe(0);
});

it.each(["SyntaxError", "IndexError", "timeout"])("never retries a %s trace on the server", async (type) => {
  const errorTrace = { ...trace, error: { type, line: 1, message: "user code error" } };
  const engine = { initialize: vi.fn().mockResolvedValue(), getStatus: () => "ready", execute: vi.fn().mockResolvedValue(errorTrace), terminate: vi.fn() };
  const classify = vi.fn().mockResolvedValue(metadata);
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useTracer({ engine, classify }));
  await act(async () => { await result.current.analyzeCode("bad", "arr"); });
  expect(result.current.traceData.error).toEqual(errorTrace.error);
  expect(result.current.runtimeStatus).toBe("ready");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("blocks execution until initialization reports ready", async () => {
  const pending = deferred();
  const engine = { initialize: () => pending.promise, getStatus: () => "loading", execute: vi.fn(), terminate: vi.fn() };
  const { result } = renderHook(() => useTracer({ engine }));
  expect(result.current.canRun).toBe(false);
  await expect(result.current.analyzeCode("bubble", "arr")).resolves.toBeNull();
  expect(engine.execute).not.toHaveBeenCalled();
});
