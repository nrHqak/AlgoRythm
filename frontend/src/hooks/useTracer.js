import { useState } from "react";

function getApiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

export function useTracer() {
  const [traceData, setTraceData] = useState({
    steps: [],
    error: null,
    total_steps: 0,
    truncated: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  async function analyzeCode(code, arrayVar) {
    setIsLoading(true);
    setRequestError("");

    try {
      const response = await fetch(getApiUrl("/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, array_var: arrayVar }),
      });

      if (!response.ok) {
        throw new Error(`Analyze request failed with status ${response.status}.`);
      }

      const data = await response.json();
      setTraceData({
        steps: Array.isArray(data.steps) ? data.steps : [],
        error: data.error || null,
        total_steps: data.total_steps || 0,
        truncated: Boolean(data.truncated),
      });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to analyze code.";
      setTraceData({ steps: [], error: null, total_steps: 0, truncated: false });
      setRequestError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  function resetTrace() {
    setTraceData({ steps: [], error: null, total_steps: 0, truncated: false });
    setRequestError("");
  }

  return {
    traceData,
    isLoading,
    requestError,
    analyzeCode,
    resetTrace,
  };
}
