import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useDailyQuiz } from "../useDailyQuiz";

const mocks = vi.hoisted(() => ({ tables: [], insert: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: { from: table => {
  mocks.tables.push(table);
  const query = { select: () => query, eq: () => query, order: async () => ({ data: [] }),
    insert: payload => { mocks.insert(payload); return query; },
    single: async () => ({ data: { id: "practice-answer", correct: true } }) };
  return query;
} } }));
beforeEach(() => { mocks.tables = []; mocks.insert.mockReset(); });

it.each([true, false])("records a %s quiz result as practice without XP writes", async (correct) => {
  const onPractice = vi.fn();
  const { result } = renderHook(() => useDailyQuiz("owner", "en", onPractice));
  await waitFor(() => expect(result.current.loading).toBe(false));
  const answer = result.current.currentQuestion.answer;
  await act(async () => { await result.current.submitAnswer(correct ? answer : (answer + 1) % 4); });
  expect(mocks.tables.every(table => table === "quiz_attempts")).toBe(true);
  expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("xp_earned");
  expect(result.current.feedback.xpEarned).toBe(0);
  expect(onPractice.mock.calls[0][0].xpEarned).toBe(0);
});
