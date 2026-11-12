import { useEffect, useRef, useState } from "react";
import { BrowserEngine } from "../execution/browserEngine";
import { ComplexityAnalysis } from "../execution/complexity";

/** Measurements share Playground's runtime but never enter useTracer state. */
export function useComplexity(runtimeRef) {
  const analysisRef = useRef(null);
  const active = useRef(null);
  const [complexityData, setComplexityData] = useState(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [complexityError, setComplexityError] = useState("");
  const [complexityRuntimeStatus, setComplexityRuntimeStatus] = useState("loading");

  useEffect(() => {
    analysisRef.current = new ComplexityAnalysis(new BrowserEngine({ manager: runtimeRef.current }));
    const unsubscribe = runtimeRef.current.subscribe(setComplexityRuntimeStatus);
    const operation = active;
    return () => {
      const controller = operation.current;
      operation.current = null;
      controller?.abort();
      unsubscribe();
      analysisRef.current = null;
      // Prewarm owns worker teardown; this hook never terminates normal Run.
    };
  }, [runtimeRef]);

  async function analyzeComplexity(code, arrayVar) {
    if (active.current || !analysisRef.current || runtimeRef.current?.getStatus() !== "ready") return null;
    const controller = new AbortController();
    active.current = controller;
    setComplexityLoading(true);
    setComplexityError("");
    try {
      const data = await analysisRef.current.analyze(code, arrayVar, { signal: controller.signal });
      if (active.current === controller) setComplexityData(data);
      return controller.signal.aborted ? null : data;
    } catch (error) {
      if (active.current === controller && error.name !== "AbortError") {
        const key = error.name === "timeout" ? "complexityTimeout" :
          error.code === "step_limit" ? "complexityStepLimit" :
          error.code === "insufficient" ? "complexityInsufficient" : "complexityFailed";
        setComplexityError(`playground.${key}`);
      }
      return null;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setComplexityLoading(false);
      }
    }
  }

  function cancelComplexity() {
    const controller = active.current;
    active.current = null;
    controller?.abort();
    setComplexityLoading(false);
    setComplexityData(null);
    setComplexityError("");
    const manager = runtimeRef.current;
    return manager?.getStatus() === "restarting" ? manager.initialize().catch(() => {}) : Promise.resolve();
  }

  return { complexityData, complexityLoading, complexityError, complexityRuntimeStatus, analyzeComplexity, cancelComplexity };
}
