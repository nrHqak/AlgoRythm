/** Owns one worker and one in-flight execution. Python is never imported here. */
export class PythonWorkerManager {
  constructor({
    workerFactory = () => new Worker(new URL("./python.worker.js", import.meta.url), { type: "module" }),
    executionTimeoutMs = 2000,
    initializationTimeoutMs = 60000,
  } = {}) {
    if (![executionTimeoutMs, initializationTimeoutMs].every((value) => Number.isFinite(value) && value > 0)) {
      throw new RangeError("Worker timeouts must be positive finite milliseconds.");
    }
    this.workerFactory = workerFactory;
    this.executionTimeoutMs = executionTimeoutMs;
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.status = "idle";
    this.listeners = new Set();
    this.worker = null;
    this.initialization = null;
    this.pending = null;
  }

  getStatus() {
    return this.status;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  setStatus(status) {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  initialize() {
    if (this.initialization) return this.initialization.promise;
    if (this.worker && (this.status === "ready" || this.status === "running")) return Promise.resolve();
    return this.startWorker("loading");
  }

  startWorker(status) {
    this.setStatus(status);
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    this.initialization = { promise, resolve, reject, timer: null };
    try {
      const worker = this.workerFactory();
      this.worker = worker;
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return; // Ignore messages from any retired worker.
        if (data?.type === "ready") {
          if (!this.initialization) return;
          clearTimeout(this.initialization.timer);
          const initialization = this.initialization;
          this.initialization = null;
          this.setStatus("ready");
          initialization.resolve();
          return;
        }
        if (data?.type === "error" && data.requestId == null) {
          this.failWorker(runtimeError(data.error, "InitializationError"));
          return;
        }
        if (!this.pending || data?.requestId !== this.pending.requestId) return;
        if (data.type !== "result" && data.type !== "error") return;
        const pending = this.pending;
        this.pending = null;
        clearTimeout(pending.timer);
        pending.cleanup?.();
        this.setStatus("ready");
        if (data.type === "result") pending.resolve(data.result);
        else pending.reject(runtimeError(data.error));
      };
      worker.onerror = () => {
        if (this.worker === worker) this.failWorker(runtimeError({ message: "Python worker failed." }, "WorkerError"));
      };
      worker.onmessageerror = () => {
        if (this.worker === worker) this.failWorker(runtimeError({ message: "Unable to decode worker message." }, "WorkerError"));
      };
      this.initialization.timer = setTimeout(() => {
        if (this.worker === worker) {
          this.failWorker(runtimeError({ message: "Python runtime initialization timed out." }, "InitializationTimeout"));
        }
      }, this.initializationTimeoutMs);
    } catch {
      this.failWorker(runtimeError({ message: "Unable to create Python worker." }, "WorkerError"));
    }
    return promise;
  }

  async execute({ code, arrayVar = "arr", maxSteps = 300, mode = "trace", signal } = {}) {
    if (typeof code !== "string" || typeof arrayVar !== "string" || !arrayVar || !Number.isInteger(maxSteps) || maxSteps < 1 ||
        !["trace", "count"].includes(mode) || maxSteps > (mode === "count" ? 25000 : 300)) {
      throw new TypeError("Execution requires source code, an array variable, and a positive integer maxSteps.");
    }
    if (signal?.aborted) throw new DOMException("Execution cancelled.", "AbortError");
    const initialization = this.initialize();
    const worker = this.worker;
    await initialization;
    if (signal?.aborted) throw new DOMException("Execution cancelled.", "AbortError");
    // terminate/restart may occur between readiness and this continuation.
    if (!worker || this.worker !== worker || this.status !== "ready") {
      throw runtimeError({ message: "Python worker is busy or no longer ready." }, "WorkerUnavailable");
    }
    const requestId = crypto.randomUUID();
    this.setStatus("running");
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.worker !== worker || this.pending?.requestId !== requestId) return;
        this.stopWorker(runtimeError({ message: `Execution exceeded ${this.executionTimeoutMs} milliseconds.` }, "timeout"));
        // Recovery is background work. Its failure sets error and must not create
        // an unhandled rejection if the caller only handles the timed-out run.
        this.startWorker("restarting").catch(() => {});
      }, this.executionTimeoutMs);
      const cancel = () => {
        if (this.worker !== worker || this.pending?.requestId !== requestId) return;
        this.stopWorker(new DOMException("Execution cancelled.", "AbortError"));
        this.startWorker("restarting").catch(() => {});
      };
      const cleanup = () => signal?.removeEventListener("abort", cancel);
      this.pending = { requestId, resolve, reject, timer, cleanup };
      signal?.addEventListener("abort", cancel, { once: true });
      try {
        worker.postMessage({ type: "execute", requestId, code, arrayVar, maxSteps, ...(mode === "count" ? { mode } : {}) });
      } catch {
        this.failWorker(runtimeError({ message: "Unable to send execution request." }, "WorkerError"));
      }
    });
  }

  restart() {
    this.stopWorker(runtimeError({ message: "Python worker restarted." }, "WorkerRestarted"));
    return this.startWorker("restarting");
  }

  terminate() {
    this.stopWorker(runtimeError({ message: "Python worker terminated." }, "WorkerTerminated"));
    this.setStatus("idle");
  }

  failWorker(error) {
    this.stopWorker(error);
    this.setStatus("error");
  }

  stopWorker(error) {
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    }
    if (this.initialization) {
      clearTimeout(this.initialization.timer);
      this.initialization.reject(error);
      this.initialization = null;
    }
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.cleanup?.();
      this.pending.reject(error);
      this.pending = null;
    }
  }
}

function runtimeError(payload, fallbackType = "RuntimeError") {
  const error = new Error(payload?.message || "Python runtime failed.");
  error.name = payload?.type || fallbackType;
  return error;
}
