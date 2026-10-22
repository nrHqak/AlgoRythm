import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "../useAuth.jsx";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), signUp: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabaseConfigError: "", supabase: {
  auth: { getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signUp: (...args) => mocks.signUp(...args) },
  from: () => ({ upsert: (...args) => mocks.upsert(...args) }),
} }));
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => { mocks.upsert.mockReset().mockResolvedValue({ error: null }); mocks.signUp.mockReset(); });
it.each([true, false])("creates safe profiles only with an authenticated signup session: %s", async (confirmed) => {
  mocks.signUp.mockResolvedValue({ data: { user: { id: "owner" }, session: confirmed ? {} : null }, error: null });
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await result.current.signUp({ username: "learner", email: "synthetic@example.invalid", password: "synthetic-only" }); });
  if (confirmed) expect(mocks.upsert).toHaveBeenCalledWith({ id: "owner", username: "learner" }, { onConflict: "id", ignoreDuplicates: true });
  else expect(mocks.upsert).not.toHaveBeenCalled();
});
