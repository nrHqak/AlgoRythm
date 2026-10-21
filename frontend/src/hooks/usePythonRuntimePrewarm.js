import { useEffect, useRef } from "react";

import { PythonWorkerManager } from "../runtime/pythonWorkerManager";

/** Playground owns this runtime; browser execution reuses it. */
export function usePythonRuntimePrewarm() {
  const runtimeRef = useRef(null);
  useEffect(() => {
    const manager = new PythonWorkerManager();
    runtimeRef.current = manager;
    // Initialization failure is exposed by the manager; Playground offers Retry.
    manager.initialize().catch(() => {});
    return () => {
      runtimeRef.current = null;
      manager.terminate();
    };
  }, []);
  return runtimeRef;
}
