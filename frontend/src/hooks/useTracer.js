import { useCallback, useState } from "react";

const getBaseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function useTracer() {
  const [traceData, setTraceData] = useState({
    steps: [],
    error: null,
    total_steps: 0,
    truncated: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  const analyzeCode = useCallback(async (code, arrayVar) => {
    setIsLoading(true);
    setRequestError("");

    try {
      const response = await fetch(`${getBaseUrl()}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, array_var: arrayVar }),
      });

      if (!response.ok) {
        throw new Error(`Analyze request failed with status ${response.status}.`);
      }

      const data = await response.json();
      setTraceData({
        steps: Array.isArray(data.steps) ? data.steps : [],
        error: data.error || null,
        total_steps: typeof data.total_steps === "number" ? data.total_steps : 0,
        truncated: Boolean(data.truncated),
      });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to analyze code.";
      setTraceData({
        steps: [],
        error: null,
        total_steps: 0,
        truncated: false,
      });
      setRequestError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    traceData,
    isLoading,
    requestError,
    analyzeCode,
    setTraceData,
  };
}
