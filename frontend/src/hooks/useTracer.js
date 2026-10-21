import { useCallback, useEffect, useRef, useState } from "react";

import { classifyCode } from "../execution/classifyCode";
import { BrowserEngine } from "../execution/browserEngine";
import { executeTrace } from "../execution/traceProtocol";

const UNKNOWN = { algorithm_type: "unknown", algorithm_confidence: 0 };
function initialTrace() {
  return { trace_version: null, steps: [], error: null, total_steps: 0, truncated: false,
    algorithm_type: "", algorithm_confidence: 0 };
}

export function useTracer({ runtimeRef, engine, classify = classifyCode } = {}) {
  const engineRef = useRef(null);
  const runId = useRef(0);
  const pendingClassification = useRef(null);
  const enrichment = useRef(new WeakMap());
  const identities = useRef(new WeakMap());
  const [traceData, setTraceData] = useState(initialTrace);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState("loading");
  const [classificationStatus, setClassificationStatus] = useState("idle");
  const [classificationJob, setClassificationJob] = useState(null);

  function cancelClassification() {
    const job = pendingClassification.current;
    if (job) {
      job.controller.abort();
      job.finish(UNKNOWN);
      pendingClassification.current = null;
    }
  }

  useEffect(() => {
    const generation = runId;
    const executor = engine || new BrowserEngine({ manager: runtimeRef?.current || undefined });
    engineRef.current = executor;
    const unsubscribe = executor.subscribe?.(setRuntimeStatus) || (() => {});
    setRuntimeStatus(executor.getStatus?.() || "ready");
    if (executor.initialize && executor.getStatus?.() !== "error") {
      executor.initialize().catch(() => {
        if (engineRef.current === executor && executor.getStatus?.() === "error") {
          setRuntimeStatus("error");
        }
      });
    }
    return () => {
      generation.current++;
      cancelClassification();
      unsubscribe();
      engineRef.current = null;
      if (!engine || executor !== engine) executor.terminate();
    };
  }, [engine, runtimeRef]);

  // Effects run after React commits the trace. Even a slow classifier cannot
  // hold up visualization, playback, or the analyzeCode execution promise.
  useEffect(() => {
    const job = pendingClassification.current;
    if (!job || job.id !== classificationJob || job.id !== runId.current) return undefined;
    const timer = setTimeout(() => {
      job.controller.abort();
      job.finish(UNKNOWN);
    }, 10000);
    job.timer = timer;
    Promise.resolve().then(() => classify(job.code, { signal: job.controller.signal })).then(
      (metadata) => job.finish(metadata),
      () => job.finish(UNKNOWN),
    );
    return () => {
      job.controller.abort();
      job.finish(UNKNOWN);
      clearTimeout(timer);
    };
  }, [classificationJob, classify]);

  async function analyzeCode(code, arrayVar) {
    const executor = engineRef.current;
    if (!executor || (executor.getStatus && executor.getStatus() !== "ready")) return null;
    const id = ++runId.current;
    cancelClassification();
    setClassificationJob(null);
    setClassificationStatus("idle");
    setIsLoading(true);
    setRequestError("");
    try {
      const data = await executeTrace(executor, { code, arrayVar });
      if (engineRef.current !== executor || id !== runId.current) return null;
      const result = { ...data };
      identities.current.set(result, { id, executor });
      setTraceData({ ...initialTrace(), ...result });
      let resolve;
      const promise = new Promise((res) => { resolve = res; });
      enrichment.current.set(result, promise);
      const job = { id, code, controller: new AbortController(), timer: null, done: false,
        finish(metadata) {
          if (job.done) return;
          job.done = true;
          clearTimeout(job.timer);
          const enriched = { ...result, ...metadata };
          resolve(enriched); // Session saving can await this independently of playback.
          if (job.id === runId.current && engineRef.current === executor) {
            setTraceData((previous) => ({ ...previous, ...metadata }));
            setClassificationStatus(metadata.algorithm_type === "unknown" ? "unknown" : "ready");
          }
        } };
      pendingClassification.current = job;
      setClassificationStatus("loading");
      setClassificationJob(id);
      return result;
    } catch (error) {
      if (engineRef.current !== executor || id !== runId.current) return null;
      setTraceData(initialTrace());
      setRequestError(error instanceof Error ? error.message : "Unable to analyze code.");
      return null;
    } finally {
      if (engineRef.current === executor && id === runId.current) setIsLoading(false);
    }
  }

  async function retryRuntime() {
    const executor = engineRef.current;
    if (!executor || executor.getStatus?.() !== "error") return;
    // The manager coalesces initialization; repeated clicks cannot create workers.
    try { await executor.initialize(); } catch { /* Subscription exposes failure. */ }
  }

  function invalidateExecution() {
    runId.current++;
    cancelClassification();
    setClassificationJob(null);
    setClassificationStatus("idle");
  }

  function resetTrace() {
    invalidateExecution();
    setIsLoading(false);
    setTraceData(initialTrace());
    setRequestError("");
  }

  function waitForClassification(result) {
    return enrichment.current.get(result) || Promise.resolve(result);
  }

  // Reuse the execution generation without adding fields to Trace Protocol v1.
  const captureExecution = useCallback((result) => {
    const identity = result ? identities.current.get(result) : { id: runId.current, executor: engineRef.current };
    return () => Boolean(identity?.executor && identity.id === runId.current && identity.executor === engineRef.current);
  }, []);

  return { captureExecution, invalidateExecution, traceData, isLoading, requestError, analyzeCode, resetTrace, waitForClassification,
    runtimeStatus, retryRuntime, classificationStatus,
    canRun: runtimeStatus === "ready" && !isLoading };
}
