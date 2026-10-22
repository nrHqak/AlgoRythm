import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../hooks/useLocale.jsx";
import { PlaygroundPage } from "../PlaygroundPage";

const mocks = vi.hoisted(() => ({ task: null, refresh: vi.fn(), achievements: vi.fn(), holdPlayer: false, query: vi.fn(), upsert: vi.fn(), insert: vi.fn() }));
vi.mock("../../hooks/useAuth.jsx", () => ({ useAuth: () => ({ user: { id: "test-user" }, session: { access_token: "synthetic-token" } }) }));
vi.mock("../../hooks/useProfile.jsx", () => ({ useProfile: () => ({ refreshProfile: mocks.refresh }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: (table) => {
  const filters = {};
  const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; },
    maybeSingle: () => mocks.query(table, filters), insert: (...args) => mocks.insert(table, ...args),
    upsert: (...args) => mocks.upsert(table, ...args), update: () => query };
  return query;
} } }));
vi.mock("../../hooks/usePlayer", async (importOriginal) => {
  const original = await importOriginal();
  return { usePlayer: (...args) => {
    const player = original.usePlayer(...args);
    return mocks.holdPlayer ? { ...player, isPlaying: true } : player;
  } };
});
let worker; let workers; let classifyResolve; let fetchMock; let oscillator;
beforeEach(() => {
  mocks.holdPlayer = false;
  mocks.refresh.mockReset().mockResolvedValue({ xp: 30 });
  mocks.achievements.mockReset();
  mocks.query.mockReset().mockImplementation(async (table, filters) => ({ data: table === "tasks" && filters.id ? mocks.task : null, error: null }));
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  workers = [];
  mocks.task = null; window.localStorage.clear();
  vi.stubGlobal("Worker", class { constructor() { worker = this; workers.push(this); } postMessage = vi.fn(); terminate = vi.fn(); });
  oscillator = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  vi.stubGlobal("AudioContext", class {
    state = "running"; currentTime = 0; destination = {};
    createOscillator() { return oscillator; }
    createGain() { return { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }; }
  });
  fetchMock = vi.fn((url) => {
    if (url.endsWith("/classify")) return new Promise((resolve) => { classifyResolve = resolve; });
    return Promise.resolve({ ok: true, json: async () => url.endsWith("/session/save") ? { session_id: "test-session", achievements_earned: [] } : {} });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function mount(path = "/playground") {
  return render(<LocaleProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/playground/:taskId?" element={<PlaygroundPage achievementUi={{ pushAchievements: mocks.achievements }} />} /></Routes></MemoryRouter></LocaleProvider>);
}
async function runTrace(error = null) {
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  const before = worker.postMessage.mock.calls.length;
  await waitFor(() => expect(worker.postMessage.mock.calls.length).toBeGreaterThan(before));
  const { requestId } = worker.postMessage.mock.calls.at(-1)[0];
  await act(async () => { worker.onmessage({ data: { type: "result", requestId, result: {
    trace_version: 1, error, total_steps: 2, truncated: false,
    steps: [{ step: 0, line: 2, array: [2, 1], event: "compare", highlights: [0, 1], locals: {}, error: null },
      { step: 1, line: 3, array: [1, 2], event: error ? "error" : "swap", highlights: [0, 1], locals: {}, error }],
  } } }); });
}
it("keeps editor, visualization, playback and audio usable before enrichment, then saves the detected algorithm", async () => {
  const { container } = mount();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(true);
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(screen.getByText("Detecting algorithm…")).toBeTruthy();
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/analyze"))).toBe(false);
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/complexity"))).toBe(false);
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/session/save"))).toBe(false);
  expect(oscillator.start).toHaveBeenCalled();
  const sounds = oscillator.start.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Mute Audio" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  expect(oscillator.start.mock.calls.length).toBe(sounds);
  await act(async () => { classifyResolve({ ok: true, json: async () => ({ algorithm_type: "bubble_sort", algorithm_confidence: 0.94 }) }); });
  await waitFor(() => expect(screen.getByText("Bubble Sort detected")).toBeTruthy());
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/session/save"))).toBe(true));
  const [, request] = fetchMock.mock.calls.find(([url]) => url.endsWith("/session/save"));
  expect(JSON.parse(request.body)).toMatchObject({ algorithm_type: "bubble_sort", total_steps: 2 });
  expect(request.headers.Authorization).toBe("Bearer synthetic-token");
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Load example"), { target: { value: "binary_search" } });
  expect(container.querySelector("textarea.code-textarea").value).toContain("left = 0");
  expect(screen.queryByText("Bubble Sort detected")).toBeNull();
});
it("loads task starter code and preserves Python error highlighting without server retry", async () => {
  mocks.task = { id: "task-1", title: "Starter task", difficulty: "easy", starter_code: "arr = [1]\nvalue = arr[9]", description: "Test starter" };
  const { container } = mount("/playground/task-1");
  await waitFor(() => expect(container.querySelector("textarea.code-textarea")?.value).toBe(mocks.task.starter_code));
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace({ type: "IndexError", message: "list index out of range", line: 2 });
  expect(container.querySelector(".editor-line-number.is-error").textContent).toBe("2");
  expect(worker.postMessage).toHaveBeenCalledOnce();
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/analyze"))).toBe(false);
});

async function sendCounts(startIndex, counts = [10, 20, 40, 80, 160]) {
  for (let index = 0; index < counts.length; index++) {
    await waitFor(() => expect(worker.postMessage.mock.calls.length).toBe(startIndex + index + 1));
    const request = worker.postMessage.mock.calls.at(-1)[0];
    expect(request.mode).toBe("count");
    await act(async () => { worker.onmessage({ data: { type: "result", requestId: request.requestId,
      result: { count: counts[index], error: null, truncated: false } } }); });
  }
}

it("explicit complexity samples stay separate from playback and repeat instantly from cache", async () => {
  const { container } = mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const editor = container.querySelector(".code-textarea").value;
  expect(screen.getByText("Not analyzed yet")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await sendCounts(1);
  expect(screen.getByText("O(n)")).toBeTruthy();
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  expect(container.querySelector(".code-textarea").value).toBe(editor);
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/complexity"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await act(async () => {});
  expect(worker.postMessage).toHaveBeenCalledTimes(6);
  fireEvent.change(container.querySelector(".code-textarea"), { target: { value: editor + "\nfinal = arr" } });
  expect(screen.getByText("Not analyzed yet")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await sendCounts(6);
  expect(worker.postMessage).toHaveBeenCalledTimes(11);
});

it("complexity timeout preserves the visible trace and worker recovery restores Playground", async () => {
  const { container } = mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  fireEvent.change(container.querySelector(".code-textarea"), { target: { value: "while True: pass" } });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.getByRole("alert").textContent).toContain("exceeded 2 seconds");
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(2);
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  vi.useRealTimers();
});

it("starting Run cancels complexity before dispatching the user's trace on a fresh worker", async () => {
  mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  await waitFor(() => expect(workers).toHaveLength(2));
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
  const request = worker.postMessage.mock.calls[0][0];
  expect(request.mode).toBeUndefined();
  await act(async () => { worker.onmessage({ data: { type: "result", requestId: request.requestId, result: {
    trace_version: 1, steps: [], total_steps: 0, error: null, truncated: false,
  } } }); });
});

it("capped complexity is a secondary error and teardown cancels pending samples", async () => {
  const { unmount } = mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2));
  const request = worker.postMessage.mock.calls.at(-1)[0];
  await act(async () => { worker.onmessage({ data: { type: "result", requestId: request.requestId,
    result: { count: 25000, error: null, truncated: true } } }); });
  expect(screen.getByRole("alert").textContent).toContain("step limit");
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(3));
  unmount();
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(workers).toHaveLength(1);
});

it("compressed mentor context keeps the array after locals deduplication", async () => {
  mocks.holdPlayer = true;
  const { unmount } = mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  vi.useFakeTimers();
  // The timer was created before fake timers; rerender a new trace to install it.
  const before = worker.postMessage.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  const request = worker.postMessage.mock.calls[before][0];
  await act(async () => { worker.onmessage({ data: { type: "result", requestId: request.requestId, result: {
    trace_version: 1, total_steps: 1, truncated: false, error: null,
    steps: [{ step: 0, line: 2, array: [2, 1], event: "compare", highlights: [0, 1], locals: { i: 0 }, error: null }],
  } } }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
  const [, options] = fetchMock.mock.calls.find(([url]) => url.endsWith("/mentor"));
  const context = JSON.parse(JSON.parse(options.body).trace_context);
  expect(context).toMatchObject({ array: [2, 1], locals: { i: 0 } });
  unmount(); vi.useRealTimers();
});

it.each([".code-textarea", "#array-var"])("editing %s cancels pending complexity without clearing the visible trace", async (selector) => {
  const { container } = mount();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  fireEvent.click(screen.getByRole("button", { name: "Analyze Complexity" }));
  await waitFor(() => expect(worker.postMessage).toHaveBeenCalledTimes(2));
  fireEvent.change(container.querySelector(selector), { target: { value: selector === "#array-var" ? "values" : "arr = [3, 2, 1]" } });
  await waitFor(() => expect(workers).toHaveLength(2));
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(screen.getByText("Not analyzed yet")).toBeTruthy();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
});


function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const metadataResponse = (algorithm_type = "bubble_sort") => ({ ok: true, json: async () => ({ algorithm_type, algorithm_confidence: 0.94 }) });
const sessionResponse = (session_id = "saved", achievements_earned = []) => ({ ok: true, json: async () => ({ session_id, achievements_earned, xp_awarded: 5, reward_status: "awarded", completion_verified: false, replayed: false }) });
async function ready() { await act(async () => { worker.onmessage({ data: { type: "ready" } }); }); }
function taskFixture() {
  return { id: "task-1", title: "Starter task", difficulty: "easy", starter_code: "arr = [2, 1]\narr.sort()", order_index: 1, max_xp: 100, expected_algorithm: "bubble_sort" };
}

it("commits trace before settlement; browser never writes task rewards while classification waits", async () => {
  mocks.task = taskFixture();
  mount("/playground/task-1"); await screen.findByText("Starter task"); await ready(); await runTrace();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(screen.getByText("Saving progress…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/session/save"))).toBe(false);
});

it("preserves task/session snapshots, XP and achievements, and refreshes profile once after saving", async () => {
  mocks.task = taskFixture();
  const pendingSave = deferred(); const pendingProfile = deferred();
  mocks.refresh.mockReturnValue(pendingProfile.promise);
  fetchMock.mockImplementation((url) => url.endsWith("/classify") ? Promise.resolve(metadataResponse()) : pendingSave.promise);
  const { container } = mount("/playground/task-1");
  await screen.findByText("Starter task"); await ready(); await runTrace();
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/session/save"))).toBe(true));
  fireEvent.change(container.querySelector(".code-textarea"), { target: { value: "arr = [99]" } });
  fireEvent.change(container.querySelector("#array-var"), { target: { value: "other" } });
  const [, options] = fetchMock.mock.calls.find(([url]) => url.endsWith("/session/save"));
  expect(JSON.parse(options.body)).toMatchObject({ code: mocks.task.starter_code, array_var: "arr", algorithm_type: "bubble_sort",
    total_steps: 2, execution_succeeded: true, error: null, task_id: "task-1", idempotency_key: expect.any(String) });
  expect(JSON.parse(options.body)).not.toHaveProperty("xp_earned");
  expect(JSON.parse(options.body)).not.toHaveProperty("task_completed");
  expect(JSON.parse(options.body).trace).toHaveLength(2);
  expect(options.headers.Authorization).toBe("Bearer synthetic-token");
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const awards = [{ id: "award-1", slug: "first_run" }];
  await act(async () => { pendingSave.resolve(sessionResponse("saved-task", awards)); });
  expect(screen.getByText("+5 XP activity reward saved.")).toBeTruthy();
  expect(mocks.achievements).toHaveBeenCalledWith(awards);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(mocks.refresh.mock.calls[0][0].isCurrent()).toBe(true);
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  expect(screen.getByText("Saving progress…")).toBeTruthy();
  await act(async () => { pendingProfile.resolve({ xp: 210 }); });
  expect(screen.queryByText("Saving progress…")).toBeNull();
});

it.each(["session", "classifier"])("isolates %s failure from successful execution and playback", async (failure) => {
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return failure === "classifier" ? Promise.reject(new Error("classification offline")) : Promise.resolve(metadataResponse());
    return Promise.resolve(failure === "session" ? { ok: false, status: 503 } : sessionResponse());
  });
  mount();
  await ready(); await runTrace();
  await waitFor(() => expect(screen.queryByText("Saving progress…")).toBeNull());
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  expect(worker.postMessage).toHaveBeenCalledOnce();
  if (failure === "classifier") {
    expect(screen.getByText("Unknown detected")).toBeTruthy();
    const [, request] = fetchMock.mock.calls.find(([url]) => url.endsWith("/session/save"));
    expect(JSON.parse(request.body).algorithm_type).toBe("unknown");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  } else {
    expect(screen.getByText(/Progress could not be saved/)).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
  }
});

it("reactive mentor starts from the committed error while classifier/save wait; failure preserves that error", async () => {
  const pendingMentor = deferred();
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return new Promise((resolve) => { classifyResolve = resolve; });
    if (url.endsWith("/mentor")) {
      expect(document.querySelector(".editor-line-number.is-error").textContent).toBe("2");
      return pendingMentor.promise;
    }
    return Promise.resolve(sessionResponse());
  });
  const { container } = mount(); await ready();
  await runTrace({ type: "IndexError", message: "bad index", line: 2 });
  const [, request] = fetchMock.mock.calls.find(([url]) => url.endsWith("/mentor"));
  expect(JSON.parse(request.body)).toMatchObject({ error: "IndexError: bad index", error_line: 2, mode: "reactive" });
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/session/save"))).toBe(false);
  expect(screen.getByText("Detecting algorithm…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  await act(async () => { pendingMentor.reject(new Error("mentor offline")); });
  expect(screen.getByRole("alert").textContent).toContain("mentor offline");
  expect(container.querySelector(".editor-line-number.is-error").textContent).toBe("2");
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  await act(async () => { classifyResolve(metadataResponse("unknown")); });
  expect(screen.getByText("+5 XP activity reward saved.")).toBeTruthy();
});

it("ignores stale classifier, persistence, achievements and profile completions across rapid Runs", async () => {
  const oldClassify = deferred(); const oldSave = deferred(); const freshSave = deferred();
  let classifications = 0; let saves = 0;
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return ++classifications === 1 ? oldClassify.promise : Promise.resolve(metadataResponse("binary_search"));
    return ++saves === 1 ? oldSave.promise : freshSave.promise;
  });
  mount(); await ready(); await runTrace();
  await runTrace(); // A classifier is aborted/settled unknown; its historical save remains allowed.
  await waitFor(() => expect(saves).toBe(1));
  expect(screen.getByText("Binary Search detected")).toBeTruthy();
  await act(async () => { oldClassify.resolve(metadataResponse("bubble_sort")); oldSave.resolve(sessionResponse("old-session", [{ id: "old-award" }])); });
  await waitFor(() => expect(saves).toBe(2));
  expect(screen.queryByText("+5 XP activity reward saved.")).toBeNull();
  expect(mocks.achievements).not.toHaveBeenCalled();
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(screen.getByText("Saving progress…")).toBeTruthy();
  await act(async () => { freshSave.resolve(sessionResponse("new-session", [{ id: "new-award" }])); });
  expect(screen.getByText("Binary Search detected")).toBeTruthy();
  expect(mocks.achievements).toHaveBeenCalledExactlyOnceWith([{ id: "new-award" }]);
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
});

it("ignores old reactive mentor replies without clearing the newer request or its error context", async () => {
  const oldMentor = deferred(); const freshMentor = deferred(); let mentors = 0;
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return Promise.resolve(metadataResponse("unknown"));
    if (url.endsWith("/mentor")) return ++mentors === 1 ? oldMentor.promise : freshMentor.promise;
    return Promise.resolve(sessionResponse(`session-${mentors}`));
  });
  const { container } = mount(); await ready();
  await runTrace({ type: "IndexError", message: "old error", line: 2 });
  await runTrace({ type: "SyntaxError", message: "new error", line: 3 });
  const mentorCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith("/mentor"));
  expect(mentorCalls[0][1].signal.aborted).toBe(true);
  await act(async () => { oldMentor.resolve({ ok: true, json: async () => ({ message: "obsolete hint" }) }); });
  expect(screen.queryByText("obsolete hint")).toBeNull();
  expect(screen.getByText("Awaiting mentor signal...")).toBeTruthy();
  expect(container.querySelector(".editor-line-number.is-error").textContent).toBe("3");
  await act(async () => { freshMentor.resolve({ ok: true, json: async () => ({ message: "current hint" }) }); });
  expect(screen.getByText("current hint")).toBeTruthy();
  expect(screen.queryByText("obsolete hint")).toBeNull();
  expect(mocks.insert.mock.calls.find(([, row]) => row.message === "obsolete hint")[1].session_id).toBe("session-1");
});

it("uses distinct operation keys for new Runs and never submits bonus eligibility claims", async () => {
  mocks.task = taskFixture();
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse() : sessionResponse()));
  mount("/playground/task-1"); await screen.findByText("Starter task"); await ready();
  await runTrace(); await runTrace();
  const payloads = fetchMock.mock.calls.filter(([url]) => url.endsWith("/session/save")).map(([, options]) => JSON.parse(options.body));
  expect(payloads).toHaveLength(2);
  expect(payloads[0].idempotency_key).not.toBe(payloads[1].idempotency_key);
  for (const payload of payloads) for (const field of ["xp_earned", "task_completed", "task_attempts", "mentor_messages_count", "solved"])
    expect(payload).not.toHaveProperty(field);
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it("a failed middle settlement releases the queue without overtaking an older pending save", async () => {
  const oldSave = deferred(); let saves = 0;
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return Promise.resolve(metadataResponse());
    saves++;
    return saves === 1 ? oldSave.promise : Promise.resolve(saves === 2 ? { ok: false, status: 503 } : sessionResponse("run-c"));
  });
  mount(); await ready(); await runTrace(); await runTrace(); await runTrace();
  expect(saves).toBe(1);
  await act(async () => { oldSave.resolve(sessionResponse("run-a")); });
  await waitFor(() => expect(saves).toBe(3));
  expect(mocks.refresh).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/Progress could not be saved/)).toBeNull();
});

it("a late persistence failure cannot replace a newer successful run's save state", async () => {
  const oldSave = deferred(); let saves = 0;
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return Promise.resolve(metadataResponse());
    return ++saves === 1 ? oldSave.promise : Promise.resolve(sessionResponse());
  });
  mount(); await ready(); await runTrace(); await runTrace();
  await act(async () => { oldSave.reject(new Error("obsolete failure")); });
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(screen.queryByText(/obsolete failure/)).toBeNull();
  expect(screen.getByText("+5 XP activity reward saved.")).toBeTruthy();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
});

it("mentor message persistence failure is separate from both the Python error and session saving", async () => {
  mocks.insert.mockResolvedValue({ error: new Error("message storage offline") });
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse("unknown")
    : url.endsWith("/mentor") ? { ok: true, json: async () => ({ message: "Helpful hint" }) } : sessionResponse()));
  const { container } = mount(); await ready(); await runTrace({ type: "IndexError", message: "bad index", line: 2 });
  expect(screen.getByText("Helpful hint")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Mentor conversation could not be saved.");
  expect(container.querySelector(".editor-line-number.is-error").textContent).toBe("2");
  expect(screen.getByText("+5 XP activity reward saved.")).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("resetting the example invalidates a pending profile refresh with the same execution generation", async () => {
  const profile = deferred(); mocks.refresh.mockReturnValue(profile.promise);
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse() : sessionResponse()));
  mount(); await ready(); await runTrace();
  const isCurrent = mocks.refresh.mock.calls[0][0].isCurrent;
  expect(isCurrent()).toBe(true);
  fireEvent.change(screen.getByLabelText("Load example"), { target: { value: "binary_search" } });
  expect(isCurrent()).toBe(false);
  await act(async () => { profile.resolve({ xp: 30 }); });
  expect(screen.queryByText("Saving progress…")).toBeNull();
  expect(screen.queryByText("+5 XP activity reward saved.")).toBeNull();
  expect(screen.queryByText("Bubble Sort detected")).toBeNull();
});

it("shows free-chat answers before saving while linking their stored messages to the matching session", async () => {
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return new Promise((resolve) => { classifyResolve = resolve; });
    return Promise.resolve(url.endsWith("/mentor") ? { ok: true, json: async () => ({ message: "Fast answer" }) } : sessionResponse("matching-session"));
  });
  mount(); await ready(); await runTrace();
  const input = screen.getByPlaceholderText("Ask about the current step, algorithm ideas, or debugging patterns");
  fireEvent.change(input, { target: { value: "How does this work?" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Fast answer");
  expect(input.disabled).toBe(false);
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  await act(async () => { classifyResolve(metadataResponse()); });
  expect(mocks.insert.mock.calls.map(([, record]) => record)).toMatchObject([
    { role: "user", message: "How does this work?", session_id: "matching-session", user_id: "test-user" },
    { role: "mentor", message: "Fast answer", session_id: "matching-session", user_id: "test-user" },
  ]);
});

it("reactive help arrives when the atomic settlement fails, preserving the Python error", async () => {
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse("unknown") :
    url.endsWith("/session/save") ? { ok: false, status: 503 } : { ok: true, json: async () => ({ message: "Independent error hint" }) }));
  const { container } = mount(); await ready(); await runTrace({ type: "IndexError", message: "bad index", line: 2 });
  expect(screen.getByText("Independent error hint")).toBeTruthy();
  expect(screen.getByText(/Progress could not be saved/)).toBeTruthy();
  expect(container.querySelector(".editor-line-number.is-error").textContent).toBe("2");
  expect(mocks.insert.mock.calls[0][1].session_id).toBeNull();
});

it("refreshes cumulative XP from an older successful save even when the newest save fails", async () => {
  const oldSave = deferred(); const profile = deferred(); let saves = 0;
  mocks.refresh.mockReturnValue(profile.promise);
  fetchMock.mockImplementation((url) => {
    if (url.endsWith("/classify")) return Promise.resolve(metadataResponse());
    return ++saves === 1 ? oldSave.promise : Promise.resolve({ ok: false, status: 503 });
  });
  mount(); await ready(); await runTrace(); await runTrace();
  await act(async () => { oldSave.resolve(sessionResponse("old-session", [{ id: "old-award" }])); });
  await screen.findByText(/Progress could not be saved/);
  expect(mocks.refresh).toHaveBeenCalledOnce();
  const profileCurrent = mocks.refresh.mock.calls[0][0].isCurrent;
  expect(profileCurrent()).toBe(true);
  expect(mocks.achievements).not.toHaveBeenCalled();
  expect(screen.queryByText("+5 XP activity reward saved.")).toBeNull();
  await runTrace(); // The old refresh cannot commit once Run C begins.
  expect(profileCurrent()).toBe(false);
  await act(async () => { profile.resolve({ xp: 30 }); });
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
});

it("successful execution does not issue verified completion, XP, or unlock writes from the browser", async () => {
  mocks.task = taskFixture();
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse() :
    { ok: true, json: async () => ({ session_id: "saved", xp_awarded: 0, reward_status: "daily_limit", achievements_earned: [] }) }));
  mount("/playground/task-1"); await screen.findByText("Starter task"); await ready(); await runTrace();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(screen.getByText("Session saved. No additional activity XP is eligible.")).toBeTruthy();
  expect(screen.queryByText(/XP activity reward saved/)).toBeNull();
  expect(mocks.achievements).toHaveBeenCalledWith([]);
});

it("slow optional audio cannot delay tracing, and delayed sounds from older Runs are ignored", async () => {
  const audio = deferred();
  vi.stubGlobal("AudioContext", class {
    state = "suspended"; currentTime = 0; destination = {};
    resume = () => audio.promise.then(() => { this.state = "running"; });
    createOscillator() { return oscillator; }
    createGain() { return { connect: vi.fn(), gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } }; }
  });
  mount(); await ready(); await runTrace();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(oscillator.start).not.toHaveBeenCalled();
  await runTrace();
  await act(async () => { audio.resolve(); });
  expect(oscillator.start).toHaveBeenCalledOnce();
  expect(worker.postMessage).toHaveBeenCalledTimes(2);
});

it("optional audio failure cannot prevent a successful trace or create an execution error", async () => {
  vi.stubGlobal("AudioContext", class { constructor() { throw new Error("Audio unavailable"); } });
  mount(); await ready(); await runTrace();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  expect(screen.queryByText(/Audio unavailable/)).toBeNull();
  expect(worker.postMessage).toHaveBeenCalledOnce();
});

it("shows Retry for runtime failure, blocks Run, and executes locally after retry", async () => {
  mount();
  await act(async () => { worker.onerror({}); });
  expect(screen.getByText("Python runtime unavailable. Retry initialization.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(true);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry", exact: true }));
  expect(workers).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Retry", exact: true })).toBeNull();
  await act(async () => { worker.onmessage({ data: { type: "ready" } }); });
  await runTrace();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/classify"]);
  expect(screen.queryByRole("button", { name: "Retry", exact: true })).toBeNull();
});

it("starts a new equal-length trace at the first step and stops old playback", async () => {
  mount(); await ready(); await runTrace();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("img", { name: "swap event at step 2 of 2" })).toBeTruthy();
  await runTrace();
  expect(screen.getByRole("img", { name: "compare event at step 1 of 2" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await runTrace();
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
});

it("displays the Python error message even when Mentor is unavailable", async () => {
  fetchMock.mockImplementation((url) => Promise.resolve(url.endsWith("/classify") ? metadataResponse("unknown")
    : { ok: false, status: 503 }));
  mount(); await ready();
  await runTrace({ type: "SyntaxError", message: "invalid syntax", line: 2 });
  expect(screen.getByText("SyntaxError: invalid syntax")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Run" }).disabled).toBe(false);
});
