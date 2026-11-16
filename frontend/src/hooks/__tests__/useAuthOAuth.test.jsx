import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../useAuth.jsx";

const mocks = vi.hoisted(() => ({
  configured: true, initialize: vi.fn(), getSession: vi.fn(), oauth: vi.fn(), password: vi.fn(), signOut: vi.fn(),
  listener: null, unsubscribe: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({
  get supabaseConfigError() { return mocks.configured ? "" : "Missing public Supabase configuration"; },
  get supabase() {
    return mocks.configured ? { auth: {
      initialize: mocks.initialize, getSession: mocks.getSession, signInWithOAuth: mocks.oauth,
      signInWithPassword: mocks.password, signOut: mocks.signOut,
      onAuthStateChange: callback => {
        mocks.listener = callback;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    } } : null;
  },
}));
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
const googleSession = { user: { id: "google-owner", app_metadata: { provider: "google" } } };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true;
  mocks.initialize.mockResolvedValue({ error: null });
  window.history.replaceState(null, "", "/auth");
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.oauth.mockResolvedValue({ data: { provider: "google", url: "https://accounts.google.com" }, error: null });
  mocks.password.mockResolvedValue({ data: { session: googleSession }, error: null });
  mocks.signOut.mockImplementation(async () => {
    mocks.listener("SIGNED_OUT", null);
    return { error: null };
  });
});
afterEach(() => window.history.replaceState(null, "", "/"));

it("initiates Google OAuth with this origin's /auth callback and does not manufacture a session", async () => {
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.signInWithGoogle(); });
  expect(mocks.oauth).toHaveBeenCalledExactlyOnceWith({
    provider: "google", options: { redirectTo: `${window.location.origin}/auth` },
  });
  expect(result.current.user).toBeNull();
});

it("surfaces SDK initiation errors without starting another auth flow", async () => {
  mocks.oauth.mockResolvedValue({ error: new Error("Provider disabled") });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await expect(result.current.signInWithGoogle()).rejects.toThrow("Provider disabled");
  expect(mocks.oauth).toHaveBeenCalledTimes(1);
  expect(mocks.password).not.toHaveBeenCalled();
});

it("fails safely when public client configuration is missing", async () => {
  mocks.configured = false;
  const { result } = renderHook(() => useAuth(), { wrapper });
  expect(result.current.loading).toBe(false);
  await expect(result.current.signInWithGoogle()).rejects.toThrow("Missing public");
  expect(mocks.oauth).not.toHaveBeenCalled();
});

it("restores the SDK callback session and persists normal session refresh events", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: googleSession }, error: null });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe("google-owner"));
  const refreshed = { ...googleSession, expires_at: 2000000000 };
  act(() => mocks.listener("TOKEN_REFRESHED", refreshed));
  expect(result.current.session).toBe(refreshed);
  await act(async () => { await result.current.signOut(); });
  expect(result.current.session).toBeNull();
  expect(result.current.user).toBeNull();
});

it.each(["SIGNED_IN", "SIGNED_OUT"])("a delayed initial read cannot overwrite %s", async event => {
  const pending = deferred();
  mocks.getSession.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useAuth(), { wrapper });
  act(() => mocks.listener(event, event === "SIGNED_IN" ? googleSession : null));
  await act(async () => {
    pending.resolve({ data: { session: { user: { id: "stale-owner" } } }, error: null });
  });
  expect(result.current.user?.id || null).toBe(event === "SIGNED_IN" ? "google-owner" : null);
  expect(result.current.loading).toBe(false);
});

it.each(["query", "fragment"])("keeps a cancelled callback on auth despite an older session (%s)", async format => {
  window.history.replaceState(null, "", `/auth${format === "query" ? "?" : "#"}error=access_denied&error_description=private-provider-detail`);
  mocks.getSession.mockResolvedValue({ data: { session: googleSession }, error: null });
  const strictWrapper = ({ children }) => <StrictMode><AuthProvider>{children}</AuthProvider></StrictMode>;
  const { result } = renderHook(() => useAuth(), { wrapper: strictWrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.authError).toBe("auth.oauthCancelled");
  expect(window.location.href).not.toContain("private-provider-detail");
  expect(mocks.oauth).not.toHaveBeenCalled();
  act(() => mocks.listener("SIGNED_IN", googleSession));
  expect(result.current.authError).toBe("");
});

it.each(["resolved", "rejected"])("recovers from a %s session restoration failure", async kind => {
  if (kind === "resolved") mocks.getSession.mockResolvedValue({ data: { session: googleSession }, error: new Error("expired") });
  else mocks.getSession.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.user).toBeNull();
  expect(result.current.authError).toBe("auth.sessionFailed");
  act(() => mocks.listener("SIGNED_IN", googleSession));
  expect(result.current.authError).toBe("");
  expect(result.current.user.id).toBe("google-owner");
});

it("does not accept an older stored session when the SDK rejects an expired/malformed callback", async () => {
  mocks.initialize.mockResolvedValue({ error: new Error("invalid callback") });
  mocks.getSession.mockResolvedValue({ data: { session: googleSession }, error: null });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.user).toBeNull();
  expect(result.current.authError).toBe("auth.oauthFailed");
});

it("unsubscribes and ignores late auth callbacks after teardown", async () => {
  const { result, unmount } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  unmount();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  act(() => mocks.listener("SIGNED_IN", googleSession));
  expect(result.current.user).toBeNull();
});

it("retains the current session and reports a failed logout", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: googleSession }, error: null });
  mocks.signOut.mockResolvedValue({ error: new Error("Logout unavailable") });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.user?.id).toBe("google-owner"));
  await expect(result.current.signOut()).rejects.toThrow("Logout unavailable");
  expect(result.current.user.id).toBe("google-owner");
});
