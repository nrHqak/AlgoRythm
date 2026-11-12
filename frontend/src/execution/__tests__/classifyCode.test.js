import { afterEach, expect, it, vi } from "vitest";
import { classifyCode } from "../classifyCode";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("sends only source and preserves classifier fields", async () => {
  vi.stubEnv("VITE_API_URL", "http://localhost:8000/");
  const metadata = { algorithm_type: "binary_search", algorithm_confidence: 0.91 };
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => metadata });
  vi.stubGlobal("fetch", fetchMock);
  const signal = new AbortController().signal;
  await expect(classifyCode("source", { signal })).resolves.toEqual(metadata);
  expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/classify", expect.objectContaining({ signal, body: JSON.stringify({ code: "source" }) }));
});
it.each([{ algorithm_type: "bad", algorithm_confidence: 2 }, { algorithm_confidence: 0.4 }, { algorithm_type: "bad", algorithm_confidence: "0.4" }])("rejects malformed metadata %j", async (data) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
  await expect(classifyCode("source")).rejects.toThrow("Invalid classifier metadata");
});
it("preserves HTTP errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(classifyCode("source")).rejects.toThrow("503");
});
