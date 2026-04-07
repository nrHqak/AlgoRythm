import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getErrorType(session) {
  return session?.error?.type || null;
}

export function useDNA(userId) {
  const [dna, setDna] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function compute() {
      if (!userId) {
        setDna(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select("code, trace, error, solved, algorithm_type, attempts, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (isCancelled) {
        return;
      }

      if (error || !sessions || sessions.length === 0) {
        setDna(null);
        setLoading(false);
        return;
      }

      const totalSessions = sessions.length;
      const indexErrors = sessions.filter((session) => getErrorType(session) === "IndexError").length;
      const loopBoundaries = clampScore(100 - (indexErrors / totalSessions) * 200);

      const swapSessions = sessions.filter((session) =>
        ["bubble_sort", "selection_sort", "insertion_sort"].includes(session.algorithm_type)
      );
      const solvedSwap = swapSessions.filter((session) => session.solved).length;
      const swapAccuracy = clampScore((solvedSwap / Math.max(1, swapSessions.length)) * 100);

      const logicErrors = sessions.filter((session) => {
        const errorType = getErrorType(session);
        return errorType && !["IndexError", "timeout"].includes(errorType);
      }).length;
      const conditionLogic = clampScore(100 - (logicErrors / Math.max(1, totalSessions)) * 150);

      const searchSessions = sessions.filter((session) =>
        ["binary_search", "linear_search"].includes(session.algorithm_type)
      );
      const solvedSearch = searchSessions.filter((session) => session.solved).length;
      const searchPrecision = clampScore(
        searchSessions.length === 0 ? 50 : (solvedSearch / Math.max(1, searchSessions.length)) * 100
      );

      const sortSessions = sessions.filter((session) =>
        ["bubble_sort", "insertion_sort", "selection_sort"].includes(session.algorithm_type)
      );
      const solvedSort = sortSessions.filter((session) => session.solved).length;
      const sortingMastery = clampScore(
        sortSessions.length === 0 ? 50 : (solvedSort / Math.max(1, sortSessions.length)) * 100
      );

      const avgAttempts =
        sessions.reduce((sum, session) => sum + Number(session.attempts || 1), 0) / Math.max(1, totalSessions);
      const errorRecovery = clampScore(100 - (avgAttempts - 1) * 20);

      const scores = {
        "Loop Boundaries": loopBoundaries,
        "Swap Accuracy": swapAccuracy,
        "Condition Logic": conditionLogic,
        "Search Precision": searchPrecision,
        "Sorting Mastery": sortingMastery,
        "Error Recovery": errorRecovery,
      };

      const orderedScores = Object.entries(scores).sort((left, right) => left[1] - right[1]);

      setDna({
        scores,
        total_sessions: totalSessions,
        weak_spot: orderedScores[0][0],
        strong_spot: orderedScores[orderedScores.length - 1][0],
      });
      setLoading(false);
    }

    compute();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return { dna, loading };
}
