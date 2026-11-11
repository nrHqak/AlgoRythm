import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LearnPage } from "../LearnPage";

const mocks = vi.hoisted(() => ({
  profile: null,
  petInsert: vi.fn(),
  quizInsert: vi.fn(),
}));

vi.mock("../../hooks/useAuth.jsx", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("../../hooks/useLocale.jsx", () => ({ useLocale: () => ({ locale: "en", t: key => key }) }));
vi.mock("../../hooks/useProfile.jsx", () => ({
  useProfile: () => ({ profile: mocks.profile }),
  getLevelMeta: () => ({ level: 1, title: "Novice", minXp: 0, maxXp: 199 }),
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: table => {
      let payload;
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
        order: async () => ({ data: [], error: null }),
        insert: row => {
          payload = row;
          if (table === "pet_profiles") mocks.petInsert(row);
          if (table === "quiz_attempts") mocks.quizInsert(row);
          return query;
        },
        update: row => { payload = row; return query; },
        single: async () => mocks.profile?.id === "owner"
          ? { data: { id: "practice-answer", user_id: "owner", ...payload }, error: null }
          : { data: null, error: new Error("Profile foreign key is missing") },
      };
      return query;
    },
  },
}));

beforeEach(() => {
  mocks.petInsert.mockReset();
  mocks.quizInsert.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) }));
});
afterEach(() => vi.unstubAllGlobals());

it.each([null, { id: "previous-owner", xp: 5 }])(
  "waits for the current user's saved profile before creating pet or quiz records",
  async pendingProfile => {
    mocks.profile = pendingProfile;
    const renderPage = () => <MemoryRouter><LearnPage /></MemoryRouter>;
    const view = render(renderPage());

    fireEvent.click(await screen.findByRole("button", { name: "learn.quizStartAction" }));
    fireEvent.click(view.container.querySelector(".quiz-option"));
    expect(mocks.petInsert).not.toHaveBeenCalled();
    expect(mocks.quizInsert).not.toHaveBeenCalled();

    mocks.profile = { id: "owner", xp: 0 };
    view.rerender(renderPage());
    await waitFor(() => expect(mocks.petInsert).toHaveBeenCalledOnce());
    expect(mocks.petInsert.mock.calls[0][0].user_id).toBe("owner");

    fireEvent.click(view.container.querySelector(".quiz-option"));
    await waitFor(() => expect(mocks.quizInsert).toHaveBeenCalledOnce());
    expect(mocks.quizInsert.mock.calls[0][0].user_id).toBe("owner");
    expect(screen.queryByText("Profile foreign key is missing")).toBeNull();
  },
);
