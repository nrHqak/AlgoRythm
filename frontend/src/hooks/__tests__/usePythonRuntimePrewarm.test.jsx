import { StrictMode } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { usePythonRuntimePrewarm } from "../usePythonRuntimePrewarm";

const { managers, settings } = vi.hoisted(() => ({ managers: [], settings: { fail: false } }));
vi.mock("../../runtime/pythonWorkerManager", () => ({
  PythonWorkerManager: class {
    initialize = vi.fn().mockImplementation(() => settings.fail ? Promise.reject(new Error("Network unavailable")) : Promise.resolve());
    terminate = vi.fn();
    constructor() { managers.push(this); }
  },
}));

beforeEach(() => { managers.length = 0; settings.fail = false; });

it("prewarms on mount and terminates on navigation/unmount", () => {
  const { unmount } = renderHook(() => usePythonRuntimePrewarm());
  expect(managers[0].initialize).toHaveBeenCalledOnce();
  unmount();
  expect(managers[0].terminate).toHaveBeenCalledOnce();
});

it("does not leave a worker alive during React StrictMode effect replay", () => {
  const { unmount } = renderHook(() => usePythonRuntimePrewarm(), { wrapper: StrictMode });
  expect(managers).toHaveLength(2);
  expect(managers[0].terminate).toHaveBeenCalledOnce();
  expect(managers[1].initialize).toHaveBeenCalledOnce();
  unmount();
  expect(managers[1].terminate).toHaveBeenCalledOnce();
});


it("handles prewarm failure without interrupting component lifecycle", async () => {
  settings.fail = true;
  const { unmount } = renderHook(() => usePythonRuntimePrewarm());
  await Promise.resolve();
  expect(managers[0].initialize).toHaveBeenCalledOnce();
  unmount();
  expect(managers[0].terminate).toHaveBeenCalledOnce();
});
