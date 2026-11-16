import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ProtectedRoute } from "../../App";
import { AuthProvider, useAuth } from "../../hooks/useAuth.jsx";
import { LocaleProvider } from "../../hooks/useLocale.jsx";
import { ProfileProvider, useProfile } from "../../hooks/useProfile.jsx";
import { AuthPage } from "../AuthPage";
import { LearnPage } from "../LearnPage";

const mocks = vi.hoisted(() => ({
  configured: true, listener: null, session: null, profile: null, profileCommit: null,
  oauth: vi.fn(), password: vi.fn(), signup: vi.fn(), insert: vi.fn(), read: vi.fn(),
}));
vi.mock("../../lib/supabase", () => ({
  get supabaseConfigError() { return mocks.configured ? "" : "Missing public Supabase configuration"; },
  get supabase() {
    return mocks.configured ? {
      auth: {
        initialize: async () => ({ error: null }),
        getSession: async () => ({ data: { session: mocks.session }, error: null }),
        onAuthStateChange: callback => {
          mocks.listener = callback;
          return { data: { subscription: { unsubscribe() {} } } };
        },
        signInWithOAuth: mocks.oauth, signInWithPassword: mocks.password, signUp: mocks.signup,
        signOut: async () => { mocks.session = null; mocks.listener("SIGNED_OUT", null); return { error: null }; },
      },
      from: table => {
        let payload;
        const query = {
          select: () => query, eq: () => query,
          insert: row => { payload = row; mocks.insert(table, row); return query; },
          maybeSingle: async () => {
            mocks.read(table);
            return { data: table === "profiles" ? mocks.profile : null, error: null };
          },
          single: async () => {
            if (table === "profiles") {
              if (mocks.profileCommit) await mocks.profileCommit;
              mocks.profile = { ...payload, xp: 99999 }; // Legacy XP must never become authoritative.
              return { data: mocks.profile, error: null };
            }
            return { data: { id: "synthetic-child", ...payload }, error: null };
          },
          order: async () => ({ data: [], error: null }),
          then: resolve => Promise.resolve({ data: [], error: null }).then(resolve),
        };
        return query;
      },
    } : null;
  },
}));
const session = {
  user: { id: "google-owner", email: "synthetic@example.invalid", user_metadata: { full_name: "First Learner" } },
};
function Workspace() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  return <>
    <span data-testid="profile">{profile ? `${profile.id}:${profile.username}:${profile.xp}` : "Profile pending"}</span>
    <button onClick={signOut}>Log out</button>
    <LearnPage />
  </>;
}
function CurrentPath() { return <span data-testid="path">{useLocation().pathname}</span>; }
function renderApp() {
  return render(<MemoryRouter initialEntries={["/auth"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider><LocaleProvider><ProfileProvider>
      <CurrentPath />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/learn" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
      </Routes>
    </ProfileProvider></LocaleProvider></AuthProvider>
  </MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured = true; mocks.session = null; mocks.profile = null; mocks.profileCommit = null;
  mocks.oauth.mockResolvedValue({ data: { provider: "google", url: "https://accounts.google.com" }, error: null });
  mocks.password.mockImplementation(async () => { mocks.listener("SIGNED_IN", session); return { data: { session }, error: null }; });
  mocks.signup.mockResolvedValue({ data: { user: session.user, session: null }, error: null });
  window.localStorage.clear();
  window.history.replaceState(null, "", "/auth");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) }));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

it.each(["Sign In", "Create Account"])("offers Google in %s mode without requiring form fields", async mode => {
  renderApp();
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
  fireEvent.click(screen.getAllByRole("button", { name: mode })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(mocks.oauth).toHaveBeenCalledOnce());
  expect(mocks.oauth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: `${window.location.origin}/auth` } });
  expect(mocks.password).not.toHaveBeenCalled();
  expect(mocks.signup).not.toHaveBeenCalled();
  expect(screen.getByTestId("path")).toHaveTextContent("/auth");
});

it("completes a first OAuth callback, waits for persisted ownership, and logs out normally", async () => {
  let commitProfile;
  mocks.profileCommit = new Promise(resolve => { commitProfile = resolve; });
  renderApp();
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
  act(() => mocks.listener("SIGNED_IN", session));
  await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/learn"));
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith("profiles", { id: "google-owner", username: "first_learner" }));
  expect(screen.getByTestId("profile")).toHaveTextContent("Profile pending");
  expect(mocks.insert.mock.calls.map(([table]) => table)).toEqual(["profiles"]);
  expect(mocks.read).not.toHaveBeenCalledWith("reward_accounts");
  fireEvent.click(screen.getByRole("button", { name: "Begin Calibration" }));
  fireEvent.click(document.querySelector(".quiz-option"));
  expect(mocks.insert).not.toHaveBeenCalledWith("quiz_attempts", expect.anything());
  await act(async () => { commitProfile(); });
  await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("google-owner:first_learner:0"));
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith("pet_profiles", expect.objectContaining({ user_id: "google-owner" })));
  fireEvent.click(document.querySelector(".quiz-option"));
  await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith("quiz_attempts", expect.objectContaining({ user_id: "google-owner" })));
  const profileInsert = mocks.insert.mock.calls.find(([table]) => table === "profiles")[1];
  expect(Object.keys(profileInsert).sort()).toEqual(["id", "username"]);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/auth"));
  expect(screen.queryByTestId("profile")).toBeNull();
});

it("restores an existing Google session without overwriting the user's profile or rewards", async () => {
  mocks.session = session;
  mocks.profile = { id: "google-owner", username: "existing-name", xp: 99999 };
  renderApp();
  await waitFor(() => expect(screen.getByTestId("profile")).toHaveTextContent("google-owner:existing-name:0"));
  expect(mocks.insert).not.toHaveBeenCalledWith("profiles", expect.anything());
  expect(mocks.oauth).not.toHaveBeenCalled();
});

it.each(["access_denied", "server_error"])("shows safe callback feedback for %s without a redirect loop", async error => {
  window.history.replaceState(null, "", `/auth#error=${error}&error_description=private-provider-details`);
  mocks.session = session; // A prior session must not disguise a failed new OAuth attempt.
  renderApp();
  await screen.findByRole("alert");
  expect(screen.getByTestId("path")).toHaveTextContent("/auth");
  expect(screen.getByRole("alert").textContent).not.toContain("private-provider-details");
  expect(window.location.hash).toBe("");
  expect(mocks.oauth).not.toHaveBeenCalled();
});

it.each(["returned", "thrown"])("allows retry after a %s provider/configuration error and blocks duplicate clicks", async kind => {
  let finish;
  mocks.oauth.mockImplementationOnce(() => new Promise((resolve, reject) => {
    finish = () => kind === "returned" ? resolve({ error: new Error("private-error") }) : reject(new Error("private-error"));
  }));
  renderApp();
  const button = screen.getByRole("button", { name: "Continue with Google" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.click(button);
  expect(mocks.oauth).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => { finish(); });
  expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in could not be completed");
  expect(screen.getByRole("alert").textContent).not.toContain("private-error");
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(mocks.oauth).toHaveBeenCalledTimes(2));
});

it("disables authentication when the client is unconfigured", async () => {
  mocks.configured = false;
  renderApp();
  expect(await screen.findByRole("alert")).toHaveTextContent("Missing public");
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  expect(mocks.oauth).not.toHaveBeenCalled();
});

it("preserves email/password sign-in and waits for email confirmation on signup", async () => {
  renderApp();
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
  fireEvent.click(screen.getAllByRole("button", { name: "Create Account" })[0]);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "email-learner" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "synthetic@example.invalid" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Create Account" })[1]);
  expect(await screen.findByRole("status")).toHaveTextContent("Check your inbox");
  expect(screen.getByTestId("path")).toHaveTextContent("/auth");
  expect(mocks.insert).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Sign In" })[1]);
  await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/learn"));
  expect(mocks.password).toHaveBeenCalledWith({ email: "synthetic@example.invalid", password: "synthetic-password" });
  expect(mocks.oauth).not.toHaveBeenCalled();
});
