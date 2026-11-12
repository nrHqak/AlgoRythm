import { afterEach, expect, it, vi } from "vitest";

import { BrowserEngine } from "../browserEngine";
import { emptyTrace, executeTrace } from "../traceProtocol";
import { verifyBrowser, traceDifferences } from "../dev/browserVerification";

const options = { code: "arr = [1]", arrayVar: "arr", maxSteps: 300 };
afterEach(() => { vi.unstubAllEnvs(); });

it("returns browser traces and hides manager messaging behind the same interface", async () => {
  const manager = { execute: vi.fn().mockResolvedValue(emptyTrace()), initialize: vi.fn(), terminate: vi.fn(),
    restart: vi.fn(), getStatus: vi.fn().mockReturnValue("ready") };
  const engine = new BrowserEngine({ manager });
  await expect(engine.execute(options)).resolves.toEqual(emptyTrace());
  expect(manager.execute).toHaveBeenCalledWith(options);
  engine.initialize(); engine.restart(); engine.terminate();
  expect(manager.initialize).toHaveBeenCalledOnce();
  expect(manager.restart).toHaveBeenCalledOnce();
  expect(manager.terminate).toHaveBeenCalledOnce();
  expect(engine.getStatus()).toBe("ready");
});

it("keeps timeout rejection/recovery and supplies the canonical timeout trace", async () => {
  const error = Object.assign(new Error("Execution exceeded 2000 milliseconds."), { name: "timeout" });
  const engine = new BrowserEngine({ manager: { executionTimeoutMs: 2000, execute: vi.fn().mockRejectedValue(error) } });
  await expect(engine.execute(options)).rejects.toMatchObject({ name: "timeout", trace: emptyTrace({
    type: "timeout", message: "Execution exceeded 2 seconds.", line: 1,
  }) });
  await expect(executeTrace(engine, options)).resolves.toEqual(error.trace);
});

it("does not disguise infrastructure failures as Python trace results", async () => {
  const engine = new BrowserEngine({ manager: { execute: vi.fn().mockRejectedValue(new Error("Network failed")) } });
  await expect(executeTrace(engine, options)).rejects.toThrow("Network failed");
});

it("rejects invalid inputs and protocol results", async () => {
  const engine = new BrowserEngine({ manager: { execute: vi.fn().mockResolvedValue({ steps: [] }) } });
  await expect(engine.execute({ ...options, maxSteps: 301 })).rejects.toBeInstanceOf(TypeError);
  await expect(engine.execute(options)).rejects.toThrow("Trace Protocol v1");
});

it("ignores enrichment and detects meaningful trace changes", () => {
  const trace = { ...emptyTrace(), steps: [{ step: 0, line: 2, event: "swap", array: [2, 1], highlights: [0], locals: { i: 0 }, error: null }], total_steps: 1 };
  expect(traceDifferences({ ...trace, algorithm_type: "bubble_sort", _timing: {} }, trace)).toEqual([]);
  const changed = { ...trace, steps: [{ ...trace.steps[0], line: 3, highlights: [1] }] };
  expect(traceDifferences(trace, changed)).toEqual(["trace.steps.0.line: 2 vs 3", "trace.steps.0.highlights.0: 0 vs 1"]);
});

it("browser verification checks frozen traces and tears down its worker", async () => {
  const browser = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue(emptyTrace()), terminate: vi.fn() };
  const rows = await verifyBrowser({ cases: [{ name: "Example", expected: emptyTrace(), ...options }], browser });
  expect(browser.execute).toHaveBeenCalledWith(options);
  expect(rows[0].status).toBe("PASS");
  expect(browser.terminate).toHaveBeenCalledOnce();
});
