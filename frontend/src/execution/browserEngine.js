import { PythonWorkerManager } from "../runtime/pythonWorkerManager";
import { emptyTrace, executionOptions, requireTrace } from "./traceProtocol";

export class BrowserEngine {
  constructor({ manager = new PythonWorkerManager() } = {}) {
    this.manager = manager;
  }

  subscribe(listener) { return this.manager.subscribe?.(listener) || (() => {}); }
  initialize() { return this.manager.initialize(); }
  getStatus() { return this.manager.getStatus(); }
  restart() { return this.manager.restart(); }
  terminate() { this.manager.terminate(); }

  async count({ code, arrayVar = "arr", maxSteps = 25000, signal } = {}) {
    if (typeof code !== "string" || !code || typeof arrayVar !== "string" || !arrayVar ||
        !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 25000) {
      throw new TypeError("Invalid complexity count request.");
    }
    const result = await this.manager.execute({ code, arrayVar, maxSteps, mode: "count", signal });
    if (!Number.isInteger(result?.count) || result.count < 0 || typeof result.truncated !== "boolean" ||
        !(result.error === null || (result.error && typeof result.error === "object"))) {
      throw new TypeError("Invalid complexity count result.");
    }
    return result;
  }

  async execute(options) {
    const request = executionOptions(options);
    try {
      return requireTrace(await this.manager.execute(request));
    } catch (error) {
      if (error.name === "timeout") {
        // Retain the manager's rejection and recovery lifecycle while exposing
        // the canonical Trace Protocol v1 timeout result.
        error.trace = emptyTrace({
          type: "timeout",
          message: `Execution exceeded ${Math.trunc(this.manager.executionTimeoutMs / 1000)} seconds.`,
          line: 1,
        });
      }
      throw error;
    }
  }
}
