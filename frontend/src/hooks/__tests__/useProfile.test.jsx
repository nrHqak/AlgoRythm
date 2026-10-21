import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfileProvider, useProfile } from "../useProfile.jsx";

const mocks = vi.hoisted(() => ({ user: { id: "owner" }, read: vi.fn(), update: vi.fn() }));
vi.mock("../useAuth.jsx", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: () => {
  let updating = false;
  const query = { select: () => query, eq: () => query, maybeSingle: () => mocks.read(),
    update: () => { updating = true; return query; }, single: () => updating ? mocks.update() : mocks.read() };
  return query;
} } }));
const wrapper = ({ children }) => <ProfileProvider>{children}</ProfileProvider>;
function deferred() { let resolve; const promise = new Promise((res) => { resolve = res; }); return { promise, resolve }; }
const row = (xp) => ({ data: { id: "owner", xp, level: xp >= 200 ? 2 : 1 }, error: null });
beforeEach(() => {
  mocks.user = { id: "owner" };
  mocks.read.mockReset().mockResolvedValue(row(10));
  mocks.update.mockReset().mockResolvedValue(row(220));
});

it("refreshes XP after persistence and prevents older profile reads overwriting newer ones", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const old = deferred(); const fresh = deferred();
  mocks.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  let first; let second;
  act(() => { first = result.current.refreshProfile(); second = result.current.refreshProfile(); });
  await act(async () => { fresh.resolve(row(240)); await second; });
  expect(result.current.profile.xp).toBe(240);
  await act(async () => { old.resolve(row(40)); await first; });
  expect(result.current.profile.xp).toBe(240);
  expect(result.current.loading).toBe(false);
});

it("uses the originating execution predicate even when no newer refresh has started", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const pending = deferred(); let current = true;
  mocks.read.mockReturnValueOnce(pending.promise);
  let refresh;
  act(() => { refresh = result.current.refreshProfile({ isCurrent: () => current }); });
  current = false;
  await act(async () => { pending.resolve({ data: { id: "owner", xp: 220, level: 1 } }); await refresh; });
  expect(result.current.profile.xp).toBe(10);
  expect(mocks.update).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
});

it("ignores stale profile errors and guards auth changes and teardown", async () => {
  const { result, rerender, unmount } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const old = deferred();
  mocks.read.mockReturnValueOnce(old.promise);
  let refresh;
  act(() => { refresh = result.current.refreshProfile(); });
  mocks.user = null;
  rerender();
  expect(result.current.profile).toBeNull();
  await act(async () => { old.resolve({ error: new Error("old account failed") }); await refresh; });
  expect(result.current.error).toBe("");
  mocks.user = { id: "owner" }; rerender();
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const final = deferred(); mocks.read.mockReturnValueOnce(final.promise);
  act(() => { refresh = result.current.refreshProfile(); });
  unmount();
  await act(async () => { final.resolve(row(200)); await refresh; });
});

it("reports profile and level-sync failures separately from execution", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  mocks.read.mockResolvedValue({ data: { id: "owner", xp: 220, level: 1 } });
  mocks.update.mockResolvedValue({ error: new Error("level sync unavailable") });
  await act(async () => { await result.current.refreshProfile(); });
  expect(result.current.profile.xp).toBe(10);
  expect(result.current.error).toBe("level sync unavailable");
  expect(result.current.loading).toBe(false);
});
