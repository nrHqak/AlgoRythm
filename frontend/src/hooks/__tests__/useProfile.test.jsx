import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfileProvider, useProfile } from "../useProfile.jsx";

const mocks = vi.hoisted(() => ({ user: { id: "owner" }, read: vi.fn(), rewards: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("../useAuth.jsx", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: (table) => {
  const query = { select: () => query, eq: () => query,
    maybeSingle: () => table === "reward_accounts" ? mocks.rewards() : mocks.read(),
    update: (...args) => { mocks.update(...args); return query; },
    insert: (...args) => { mocks.insert(...args); return query; }, single: () => mocks.read() };
  return query;
} } }));
const wrapper = ({ children }) => <ProfileProvider>{children}</ProfileProvider>;
function deferred() { let resolve; const promise = new Promise((res) => { resolve = res; }); return { promise, resolve }; }
const row = (xp) => ({ data: { id: "owner", xp, level: xp >= 200 ? 2 : 1 }, error: null });
beforeEach(() => {
  mocks.user = { id: "owner" };
  mocks.read.mockReset().mockResolvedValue(row(1000000000));
  mocks.rewards.mockReset().mockResolvedValue(row(10));
  mocks.update.mockReset(); mocks.insert.mockReset();
});

it("uses only authoritative reward accounts and never synchronizes reward columns from the browser", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  mocks.rewards.mockResolvedValue({ data: null });
  await act(async () => { await result.current.refreshProfile(); });
  expect(result.current.profile.xp).toBe(0);
  expect(result.current.profile.level).toBe(1);
  expect(mocks.update).not.toHaveBeenCalled();
  await expect(result.current.updateProfile({ xp: 1000000000 })).rejects.toThrow("Only username");
});

it("refreshes XP and prevents older reward reads overwriting newer ones", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const old = deferred(); const fresh = deferred();
  mocks.rewards.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  let first; let second;
  act(() => { first = result.current.refreshProfile(); });
  await waitFor(() => expect(mocks.rewards).toHaveBeenCalledTimes(2));
  act(() => { second = result.current.refreshProfile(); });
  await waitFor(() => expect(mocks.rewards).toHaveBeenCalledTimes(3));
  await act(async () => { fresh.resolve(row(240)); await second; });
  await act(async () => { old.resolve(row(40)); await first; });
  expect(result.current.profile.xp).toBe(240);
});

it("uses the originating execution predicate and guards auth changes and teardown", async () => {
  const { result, rerender, unmount } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  const pending = deferred(); let current = true; let refresh;
  mocks.rewards.mockReturnValueOnce(pending.promise);
  await act(async () => { refresh = result.current.refreshProfile({ isCurrent: () => current }); });
  current = false;
  await act(async () => { pending.resolve(row(220)); await refresh; });
  expect(result.current.profile.xp).toBe(10);
  const old = deferred(); mocks.rewards.mockReturnValueOnce(old.promise);
  await act(async () => { refresh = result.current.refreshProfile(); });
  mocks.user = null; rerender();
  await act(async () => { old.resolve(row(900)); await refresh; });
  expect(result.current.profile).toBeNull();
  unmount();
});

it("reports unavailable reward state without importing a legacy balance", async () => {
  const { result } = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(result.current.profile?.xp).toBe(10));
  mocks.rewards.mockResolvedValue({ error: new Error("reward state unavailable") });
  await act(async () => { await result.current.refreshProfile(); });
  expect(result.current.profile.xp).toBe(10);
  expect(result.current.error).toBe("reward state unavailable");
});
