import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LocaleProvider } from "../../hooks/useLocale.jsx";
import { ProfilePage } from "../ProfilePage";

const mocks = vi.hoisted(() => ({ selects: [] }));
vi.mock("../../hooks/useAuth.jsx", () => ({ useAuth: () => ({ user: { id: "owner", email: "synthetic@example.invalid" } }) }));
vi.mock("../../hooks/useDNA", () => ({ useDNA: () => ({ dna: null, loading: false }) }));
vi.mock("../../components/AlgorithmDNA", () => ({ AlgorithmDNA: () => null }));
vi.mock("../../hooks/useProfile.jsx", async original => ({ ...(await original()), useProfile: () => ({
  profile: { username: "learner", xp: 5, streak: 1, level: 1 }, levelMeta: { level: 1, title: "Novice", minXp: 0, maxXp: 199 },
}) }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: table => {
  const data = {
    achievements: [{ id: "legacy", title: "Unverified legacy award", xp_reward: 10 }, { id: "trusted", title: "Trusted fixture award", xp_reward: 10 }],
    user_achievements: [{ achievement_id: "legacy", verified: false }, { achievement_id: "trusted", verified: true }],
    sessions: [{ id: "old", code: "pass", solved: true, created_at: new Date().toISOString(), reward_policy: "legacy_unverified", xp_earned: 1000000000 },
      { id: "new", code: "pass", solved: true, created_at: new Date().toISOString(), reward_policy: "activity-v1", xp_earned: 5 }],
    practice_progress: [{ task_id: "task", reported_completed: true }],
  };
  const query = { select: fields => { mocks.selects.push([table, fields]); return query; }, eq: () => query,
    order: () => query, limit: () => query, then: resolve => Promise.resolve({ data: data[table] }).then(resolve) };
  return query;
} } }));

it("labels history as reported, excludes legacy XP and distinguishes verified award records", async () => {
  render(<LocaleProvider><ProfilePage /></LocaleProvider>);
  const legacy = await screen.findByText("Unverified legacy award");
  expect(legacy.closest(".achievement-card").classList.contains("is-earned")).toBe(false);
  expect(screen.getByText("Trusted fixture award").closest(".achievement-card").classList.contains("is-earned")).toBe(true);
  expect(mocks.selects).toContainEqual(["user_achievements", "achievement_id, verified"]);
  expect(screen.getByText("+0 XP")).toBeTruthy();
  expect(screen.getByText("+5 XP")).toBeTruthy();
  expect(screen.queryByText(/1000000000/)).toBeNull();
  expect(screen.getAllByText("Reported success (unverified)").length).toBeGreaterThan(0);
  expect(screen.getByText("Tasks practiced (unverified)")).toBeTruthy();
});
