import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePlayer } from "../usePlayer";

describe("usePlayer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps next and previous actions inside trace bounds", () => {
    const { result } = renderHook(() => usePlayer(2));

    act(() => result.current.prev());
    expect(result.current.currentStep).toBe(0);

    act(() => {
      result.current.next();
      result.current.next();
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.progress).toBe(100);
  });

  it("plays to the last step and then stops", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePlayer(2));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => vi.advanceTimersByTime(1200));

    expect(result.current.currentStep).toBe(1);
    expect(result.current.isPlaying).toBe(false);
  });

  it("resets when the trace length changes", () => {
    const { result, rerender } = renderHook(({ total }) => usePlayer(total), {
      initialProps: { total: 3 },
    });
    act(() => result.current.next());
    expect(result.current.currentStep).toBe(1);

    rerender({ total: 1 });

    expect(result.current.currentStep).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });
});
