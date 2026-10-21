/** Classification enriches a committed trace; it never executes Python. */
export async function classifyCode(code, { signal } = {}) {
  const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    signal,
  });
  if (!response.ok) throw new Error(`Classification failed with status ${response.status}.`);
  const data = await response.json();
  if (typeof data.algorithm_type !== "string" || !Number.isFinite(data.algorithm_confidence) ||
      data.algorithm_confidence < 0 || data.algorithm_confidence > 1) {
    throw new TypeError("Invalid classifier metadata.");
  }
  return { algorithm_type: data.algorithm_type || "unknown", algorithm_confidence: data.algorithm_confidence };
}
