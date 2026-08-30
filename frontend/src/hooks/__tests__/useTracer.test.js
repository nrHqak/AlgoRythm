import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTracer } from "../useTracer";

describe("useTracer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a successful analyze response", async () => {
    const response = {
      steps: [{ step: 0 }],
      error: null,
      total_steps: 1,
      truncated: false,
      algorithm_type: "bubble_sort",
      algorithm_confidence: 0.98,
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(response) });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTracer());

    let returned;
    await act(async () => {
      returned = await result.current.analyzeCode("arr = [2, 1]", "arr");
    });

    expect(returned).toEqual(response);
    expect(result.current.traceData).toEqual(response);
    expect(result.current.requestError).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/analyze",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("clears stale trace state after a non-success response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ steps: [{ step: 0 }], total_steps: 1 }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTracer());

    await act(async () => {
      await result.current.analyzeCode("arr = [1]", "arr");
      await result.current.analyzeCode("arr = [1]", "arr");
    });

    expect(result.current.traceData.steps).toEqual([]);
    expect(result.current.requestError).toContain("status 500");
  });

  it("returns null and records a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { result } = renderHook(() => useTracer());

    let returned;
    await act(async () => {
      returned = await result.current.analyzeCode("arr = [1]", "arr");
    });

    expect(returned).toBeNull();
    expect(result.current.requestError).toBe("offline");
    expect(result.current.isLoading).toBe(false);
  });
});
