import { expect, it, vi } from "vitest";
import { ComplexityAnalysis, complexitySource, fitComplexity } from "../complexity";
import { BrowserEngine } from "../browserEngine";

it("ports descending first-list replacement and the existing least-squares profiles", () => {
  expect(complexitySource("массив = [2, 1]", 3)).toBe("массив = [3, 2, 1]");
  expect(complexitySource("other = [9]\narr = [1, 2]", 3)).toBe("other = [3, 2, 1]\narr = [1, 2]");
  expect(fitComplexity([5, 10, 20, 40, 80], [10, 20, 40, 80, 160])).toMatchObject({ complexity: "O(n)", confidence: 1 });
  expect(fitComplexity([5, 10, 20, 40, 80], [25, 100, 400, 1600, 6400])).toMatchObject({ complexity: "O(n²)", confidence: 1 });
  expect(fitComplexity([5, 10, 20], [0, 2, 0]).error).toBe("not enough data");
});

it("uses BrowserEngine count messages and caches by code, selected array and parameters", async () => {
  const manager = { execute: vi.fn().mockResolvedValue({ count: 10, error: null, truncated: false }) };
  const analysis = new ComplexityAnalysis(new BrowserEngine({ manager }));
  const first = await analysis.analyze("arr = [2, 1]", "arr");
  expect(manager.execute).toHaveBeenCalledTimes(5);
  expect(manager.execute.mock.calls.map(([request]) => request.mode)).toEqual(Array(5).fill("count"));
  expect(manager.execute.mock.calls[4][0]).toMatchObject({ maxSteps: 25000, arrayVar: "arr" });
  expect(await analysis.analyze("arr = [2, 1]", "arr")).toBe(first);
  expect(manager.execute).toHaveBeenCalledTimes(5);
  await analysis.analyze("arr = [3, 2, 1]", "arr");
  await analysis.analyze("arr = [3, 2, 1]", "values");
  expect(manager.execute).toHaveBeenCalledTimes(15);
  expect(new ComplexityAnalysis({}, { maxSteps: 20 }).key("code", "arr")).not.toBe(analysis.key("code", "arr"));
});

it("keeps the cache bounded and does not cache failed/capped measurements", async () => {
  const engine = { count: vi.fn().mockResolvedValue({ count: 10, error: null, truncated: false }) };
  const analysis = new ComplexityAnalysis(engine, { cacheLimit: 1 });
  await analysis.analyze("a", "arr"); await analysis.analyze("b", "arr"); await analysis.analyze("a", "arr");
  expect(engine.count).toHaveBeenCalledTimes(15);
  engine.count.mockResolvedValue({ count: 25000, error: null, truncated: true });
  await expect(analysis.analyze("bad", "arr")).rejects.toThrow("step limit");
  await expect(analysis.analyze("bad", "arr")).rejects.toThrow("step limit");
  expect(engine.count).toHaveBeenCalledTimes(17);
});

it("stops sampling on timeout, cancellation and insufficient successful data", async () => {
  const engine = { count: vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "timeout" })) };
  const analysis = new ComplexityAnalysis(engine);
  await expect(analysis.analyze("loop", "arr")).rejects.toThrow("timeout");
  expect(engine.count).toHaveBeenCalledOnce();
  const controller = new AbortController();
  engine.count.mockImplementation(async () => { controller.abort(); return { count: 1, error: null, truncated: false }; });
  await expect(analysis.analyze("cancel", "arr", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(engine.count).toHaveBeenCalledTimes(2);
  engine.count.mockResolvedValue({ count: 1, error: { type: "IndexError" }, truncated: false });
  await expect(analysis.analyze("error", "arr")).rejects.toThrow("Not enough data");
});

import fits from "../../../../tests/fixtures/complexity_fits.json";
it.each(fits)("matches the legacy NumPy fit for $name", ({ sizes, steps, expected }) => {
  expect(fitComplexity(sizes, steps)).toMatchObject(expected);
});
