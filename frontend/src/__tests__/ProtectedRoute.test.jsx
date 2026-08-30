import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "../App";
import { useAuth } from "../hooks/useAuth.jsx";

vi.mock("../hooks/useAuth.jsx", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: null,
  supabaseConfigError: "",
}));

function renderProtected() {
  return render(
    <MemoryRouter
      initialEntries={["/private"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route
          path="/private"
          element={
            <ProtectedRoute>
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<div>Authentication page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it("shows the loading state while authentication is resolving", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: true });

    renderProtected();

    expect(screen.getByText("Loading your workspace...")).toBeInTheDocument();
  });

  it("redirects an unauthenticated visitor", () => {
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false });

    renderProtected();

    expect(screen.getByText("Authentication page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders protected content for an authenticated user", () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: "user-1" }, loading: false });

    renderProtected();

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
