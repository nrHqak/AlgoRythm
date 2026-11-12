import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PythonWorkerManager } from "../pythonWorkerManager";

class MockWorker {
  onmessage = null;
  onerror = null;
  onmessageerror = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  send(data) { this.onmessage?.({ data }); }
}

let workers;
let manager;

beforeEach(() => {
  vi.useFakeTimers();
  workers = [];
  manager = new PythonWorkerManager({
    workerFactory: () => {
      const worker = new MockWorker();
      workers.push(worker);
      return worker;
    },
  });
});

afterEach(() => {
  manager.terminate();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

async function ready() {
  const initialization = manager.initialize();
  workers.at(-1).send({ type: "ready" });
  await initialization;
}

async function execute(code = "1 + 1") {
  const promise = manager.execute({ code, arrayVar: "arr", maxSteps: 300 });
  await Promise.resolve();
  const message = workers.at(-1).postMessage.mock.calls.at(-1)[0];
  return { promise, message };
}

describe("PythonWorkerManager", () => {
  it("initializes once, shares the loading promise, and transitions to ready", async () => {
    expect(manager.getStatus()).toBe("idle");
    const first = manager.initialize();
    expect(manager.getStatus()).toBe("loading");
    expect(manager.initialize()).toBe(first);
    expect(workers).toHaveLength(1);
    workers[0].send({ type: "ready" });
    await first;
    expect(manager.getStatus()).toBe("ready");
    await manager.initialize();
    expect(workers).toHaveLength(1);
  });

  it("waits for initialization before posting an execution", async () => {
    const promise = manager.execute({ code: "pass" });
    expect(workers[0].postMessage).not.toHaveBeenCalled();
    workers[0].send({ type: "ready" });
    await Promise.resolve();
    const { requestId } = workers[0].postMessage.mock.calls[0][0];
    workers[0].send({ type: "result", requestId, result: { executed: true } });
    await expect(promise).resolves.toEqual({ executed: true });
  });

  it("sends the explicit protocol and resolves only a matching result", async () => {
    await ready();
    const { promise, message } = await execute();
    expect(message).toEqual({ type: "execute", requestId: expect.any(String), code: "1 + 1", arrayVar: "arr", maxSteps: 300 });
    expect(manager.getStatus()).toBe("running");
    workers[0].send({ type: "result", requestId: "different-id", result: { wrong: true } });
    workers[0].send({ type: "error", requestId: "different-id", error: { type: "Wrong" } });
    workers[0].send({ type: "ready" }); // A duplicate ready cannot mark a running worker ready.
    expect(manager.getStatus()).toBe("running");
    workers[0].send({ type: "result", requestId: message.requestId, result: { executed: true } });
    await expect(promise).resolves.toEqual({ executed: true });
    expect(manager.getStatus()).toBe("ready");
  });

  it("does not reuse request IDs and ignores previous execution results", async () => {
    await ready();
    const first = await execute();
    workers[0].send({ type: "result", requestId: first.message.requestId, result: {} });
    await first.promise;
    const second = await execute();
    expect(second.message.requestId).not.toBe(first.message.requestId);
    workers[0].send({ type: "result", requestId: first.message.requestId, result: {} });
    expect(manager.getStatus()).toBe("running");
    workers[0].send({ type: "result", requestId: second.message.requestId, result: { second: true } });
    await expect(second.promise).resolves.toEqual({ second: true });
  });

  it("rejects simultaneous execution without overwriting the active request", async () => {
    await ready();
    const first = await execute();
    await expect(manager.execute({ code: "pass" })).rejects.toMatchObject({ name: "WorkerUnavailable" });
    workers[0].send({ type: "result", requestId: first.message.requestId, result: {} });
    await first.promise;
  });

  it("returns a matching Python error and leaves the worker available", async () => {
    await ready();
    const { promise, message } = await execute();
    workers[0].send({ type: "error", requestId: message.requestId, error: { type: "PythonError", message: "IndexError" } });
    await expect(promise).rejects.toMatchObject({ name: "PythonError", message: "IndexError" });
    expect(manager.getStatus()).toBe("ready");
  });

  it.each(["onerror", "onmessageerror"])("handles a native worker %s and rejects execution", async (event) => {
    await ready();
    const { promise } = await execute();
    workers[0][event]({});
    await expect(promise).rejects.toMatchObject({ name: "WorkerError" });
    expect(manager.getStatus()).toBe("error");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it("rejects initialization errors and allows a fresh initialization", async () => {
    const initialization = manager.initialize();
    workers[0].send({ type: "error", requestId: null, error: { type: "InitializationError", message: "CDN unavailable" } });
    await expect(initialization).rejects.toMatchObject({ name: "InitializationError" });
    expect(manager.getStatus()).toBe("error");
    await ready();
    expect(workers).toHaveLength(2);
  });

  it("bounds initialization and rejects waiting execution", async () => {
    const promise = manager.execute({ code: "pass" });
    const rejected = expect(promise).rejects.toMatchObject({ name: "InitializationTimeout" });
    await vi.advanceTimersByTimeAsync(60000);
    await rejected;
    expect(manager.getStatus()).toBe("error");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });

  it("kills a timed-out worker, reloads, and ignores late messages from the old worker", async () => {
    await ready();
    const oldHandler = workers[0].onmessage;
    const { promise, message } = await execute("while True: pass");
    const rejected = expect(promise).rejects.toMatchObject({ name: "timeout" });
    await vi.advanceTimersByTimeAsync(2000);
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers).toHaveLength(2);
    expect(manager.getStatus()).toBe("restarting");
    oldHandler({ data: { type: "ready" } });
    oldHandler({ data: { type: "result", requestId: message.requestId, result: { stale: true } } });
    expect(manager.getStatus()).toBe("restarting");
    workers[1].send({ type: "ready" });
    const next = await execute("pass");
    oldHandler({ data: { type: "result", requestId: next.message.requestId, result: { stale: true } } });
    expect(manager.getStatus()).toBe("running");
    workers[1].send({ type: "result", requestId: next.message.requestId, result: { executed: true } });
    await expect(next.promise).resolves.toEqual({ executed: true });
  });

  it("handles failed automatic recovery without an unhandled promise", async () => {
    await ready();
    const { promise } = await execute();
    const rejected = expect(promise).rejects.toMatchObject({ name: "timeout" });
    await vi.advanceTimersByTimeAsync(2000);
    await rejected;
    workers[1].onerror({});
    expect(manager.getStatus()).toBe("error");
  });

  it("restarts during execution, rejecting the request and returning fresh readiness", async () => {
    await ready();
    const { promise } = await execute();
    const restarting = manager.restart();
    await expect(promise).rejects.toMatchObject({ name: "WorkerRestarted" });
    expect(manager.getStatus()).toBe("restarting");
    expect(manager.initialize()).toBe(restarting);
    workers[1].send({ type: "ready" });
    await restarting;
  });

  it("restarts while loading and settles the superseded initialization", async () => {
    const first = manager.initialize();
    const second = manager.restart();
    await expect(first).rejects.toMatchObject({ name: "WorkerRestarted" });
    workers[1].send({ type: "ready" });
    await second;
  });

  it("cleans up a running request and allows navigation back to initialize", async () => {
    await ready();
    const { promise } = await execute();
    manager.terminate();
    await expect(promise).rejects.toMatchObject({ name: "WorkerTerminated" });
    expect(manager.getStatus()).toBe("idle");
    expect(workers[0].onmessage).toBeNull();
    expect(workers[0].onerror).toBeNull();
    expect(workers[0].onmessageerror).toBeNull();
    manager.terminate();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    await ready();
    expect(workers).toHaveLength(2);
  });

  it("cleans up initialization and prevents execution after teardown", async () => {
    const promise = manager.execute({ code: "pass" });
    manager.terminate();
    await expect(promise).rejects.toMatchObject({ name: "WorkerTerminated" });
    expect(workers[0].postMessage).not.toHaveBeenCalled();
  });

  it("does not dispatch an already-ready execution after immediate teardown", async () => {
    await ready();
    const promise = manager.execute({ code: "pass" });
    manager.terminate();
    await expect(promise).rejects.toMatchObject({ name: "WorkerUnavailable" });
    expect(workers[0].postMessage).not.toHaveBeenCalled();
  });

  it("settles initialization if worker construction throws", async () => {
    manager.workerFactory = () => { throw new Error("Unsupported"); };
    await expect(manager.initialize()).rejects.toMatchObject({ name: "WorkerError" });
    expect(manager.getStatus()).toBe("error");
  });

  it("settles execution if posting the message throws", async () => {
    await ready();
    workers[0].postMessage.mockImplementation(() => { throw new Error("Unable to clone"); });
    await expect(manager.execute({ code: "pass" })).rejects.toMatchObject({ name: "WorkerError" });
    expect(manager.getStatus()).toBe("error");
  });

  it("validates requests and timeouts before starting a worker", async () => {
    await expect(manager.execute({ code: "pass", maxSteps: 0 })).rejects.toBeInstanceOf(TypeError);
    expect(workers).toHaveLength(0);
    expect(() => new PythonWorkerManager({ executionTimeoutMs: 0 })).toThrow(RangeError);
  });
});

it("cancels a count request, clears listeners, reloads and permits a subsequent trace", async () => {
  await ready();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const promise = manager.execute({ code: "while True: pass", mode: "count", maxSteps: 25000, signal: controller.signal });
  const rejected = expect(promise).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  expect(workers[0].postMessage.mock.calls[0][0].mode).toBe("count");
  controller.abort();
  await rejected;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledOnce();
  expect(manager.getStatus()).toBe("restarting");
  workers[1].send({ type: "ready" });
  const next = await execute("arr = [1]");
  workers[1].send({ type: "result", requestId: next.message.requestId, result: { executed: true } });
  await expect(next.promise).resolves.toEqual({ executed: true });
});

it("does not dispatch an already-cancelled count request", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(manager.execute({ code: "pass", mode: "count", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(workers).toHaveLength(0);
});
