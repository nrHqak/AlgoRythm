import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import { getLevelMeta } from "./useProfile.jsx";

const QUIZ_BANK = [
  {
    key: "time_binary",
    prompt: {
      en: "What time complexity does binary search have on a sorted array?",
      ru: "Какая временная сложность у binary search на отсортированном массиве?",
    },
    options: {
      en: ["O(n)", "O(log n)", "O(n log n)", "O(n²)"],
      ru: ["O(n)", "O(log n)", "O(n log n)", "O(n²)"],
    },
    answer: 1,
  },
  {
    key: "swap_bubble",
    prompt: {
      en: "In bubble sort, what happens when two adjacent items are out of order?",
      ru: "Что происходит в bubble sort, когда два соседних элемента стоят не по порядку?",
    },
    options: {
      en: ["Skip them", "Swap them", "Delete one", "Reverse the whole array"],
      ru: ["Пропустить", "Поменять местами", "Удалить один", "Развернуть весь массив"],
    },
    answer: 1,
  },
  {
    key: "loop_index",
    prompt: {
      en: "Which error usually points to a bad array boundary?",
      ru: "Какая ошибка чаще всего указывает на неверную границу массива?",
    },
    options: {
      en: ["SyntaxError", "IndexError", "ImportError", "IndentationError"],
      ru: ["SyntaxError", "IndexError", "ImportError", "IndentationError"],
    },
    answer: 1,
  },
  {
    key: "mid_formula",
    prompt: {
      en: "Which expression is typically used to compute mid in binary search?",
      ru: "Какое выражение обычно используют для вычисления mid в binary search?",
    },
    options: {
      en: ["left + right", "(left + right) // 2", "len(arr) // 2", "target // 2"],
      ru: ["left + right", "(left + right) // 2", "len(arr) // 2", "target // 2"],
    },
    answer: 1,
  },
  {
    key: "selection_goal",
    prompt: {
      en: "What does selection sort choose on each outer pass?",
      ru: "Что selection sort выбирает на каждом внешнем проходе?",
    },
    options: {
      en: ["A random value", "The minimum remaining value", "The last value", "Two pivots"],
      ru: ["Случайное значение", "Минимум из оставшихся", "Последний элемент", "Два pivot"],
    },
    answer: 1,
  },
  {
    key: "insertion_style",
    prompt: {
      en: "Insertion sort mainly works by:",
      ru: "Insertion sort в основном работает за счёт:",
    },
    options: {
      en: ["Partitioning", "Merging halves", "Shifting elements to insert in place", "Hashing values"],
      ru: ["Разбиения", "Слияния половин", "Сдвига элементов для вставки", "Хеширования значений"],
    },
    answer: 2,
  },
  {
    key: "linear_stop",
    prompt: {
      en: "When can linear search stop early?",
      ru: "Когда linear search может остановиться раньше?",
    },
    options: {
      en: ["Only after full scan", "When target is found", "Never", "Only on even indexes"],
      ru: ["Только после полного прохода", "Когда target найден", "Никогда", "Только на чётных индексах"],
    },
    answer: 1,
  },
  {
    key: "complexity_nested",
    prompt: {
      en: "Two full nested loops over n elements often suggest:",
      ru: "Два полных вложенных цикла по n элементам обычно означают:",
    },
    options: {
      en: ["O(log n)", "O(n)", "O(n²)", "O(1)"],
      ru: ["O(log n)", "O(n)", "O(n²)", "O(1)"],
    },
    answer: 2,
  },
  {
    key: "trace_use",
    prompt: {
      en: "What is the main purpose of a step trace in AlgoRythm?",
      ru: "В чём главная цель step trace в AlgoRythm?",
    },
    options: {
      en: ["Compress code", "Visualize execution state over time", "Deploy faster", "Replace tests"],
      ru: ["Сжать код", "Показать состояние выполнения по шагам", "Ускорить деплой", "Заменить тесты"],
    },
    answer: 1,
  },
];

function getQuizDay() {
  return new Date().toISOString().slice(0, 10);
}

function daySeed(day) {
  return day.split("-").reduce((sum, part) => sum + Number(part), 0);
}

function getDailyQuestions(day) {
  const seed = daySeed(day);
  const selected = [];
  for (let index = 0; index < 3; index += 1) {
    const question = QUIZ_BANK[(seed + index * 2) % QUIZ_BANK.length];
    if (!selected.find((item) => item.key === question.key)) {
      selected.push(question);
    }
  }

  let offset = 0;
  while (selected.length < 3) {
    const question = QUIZ_BANK[(seed + offset) % QUIZ_BANK.length];
    if (!selected.find((item) => item.key === question.key)) {
      selected.push(question);
    }
    offset += 1;
  }

  return selected;
}

function localizeQuestion(question, locale) {
  const safeLocale = locale === "ru" ? "ru" : "en";
  return {
    ...question,
    prompt: question.prompt[safeLocale],
    options: question.options[safeLocale],
  };
}

export function useDailyQuiz(userId, locale, onReward) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [started, setStarted] = useState(false);
  const lastSubmittedKeyRef = useRef(null);

  const quizDay = getQuizDay();
  const questions = useMemo(
    () => getDailyQuestions(quizDay).map((question) => localizeQuestion(question, locale)),
    [quizDay, locale]
  );
  const currentIndex = attempts.length;
  const currentQuestion = currentIndex < questions.length ? questions[currentIndex] : null;
  const completed = attempts.length >= questions.length;
  const correctCount = attempts.filter((attempt) => attempt.correct).length;

  async function loadAttempts() {
    if (!userId || !supabase) {
      setAttempts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("quiz_day", quizDay)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message || "Unable to load daily quiz.");
      setLoading(false);
      return;
    }

    setAttempts(data || []);
    if ((data || []).length >= 3) {
      setStarted(false);
    }
    setLoading(false);
  }

  async function awardQuizXp(xpEarned) {
    if (!userId || !supabase || xpEarned <= 0) {
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("xp")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    const nextXp = (profile?.xp || 0) + xpEarned;
    const levelMeta = getLevelMeta(nextXp);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ xp: nextXp, level: levelMeta.level })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }
  }

  async function submitAnswer(optionIndex = null, timedOut = false) {
    if (!currentQuestion || submitting || !userId || !supabase) {
      return;
    }

    if (lastSubmittedKeyRef.current === currentQuestion.key) {
      return;
    }

    setSubmitting(true);
    lastSubmittedKeyRef.current = currentQuestion.key;
    const correct = optionIndex === currentQuestion.answer;
    const xpEarned = correct ? 10 : timedOut ? 1 : 3;
    const responseMs = Math.max(0, Date.now() - questionStartedAt);

    try {
      const payload = {
        user_id: userId,
        quiz_day: quizDay,
        question_key: currentQuestion.key,
        prompt: currentQuestion.prompt,
        correct,
        xp_earned: xpEarned,
        response_ms: responseMs,
      };

      const { data, error: insertError } = await supabase
        .from("quiz_attempts")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          await loadAttempts();
          return;
        }
        throw insertError;
      }

      await awardQuizXp(xpEarned);

      const reward = {
        correct,
        xpEarned,
        timedOut,
        questionKey: currentQuestion.key,
      };

      setAttempts((previous) => [...previous, data]);
      setFeedback(reward);
      if (onReward) {
        await onReward(reward);
      }

      window.setTimeout(() => {
        setFeedback(null);
      }, 950);
    } catch (submitError) {
      setError(submitError.message || "Unable to submit quiz answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function startQuiz() {
    if (completed) {
      return;
    }
    setStarted(true);
    setError("");
    setFeedback(null);
    setTimeLeft(30);
    setQuestionStartedAt(Date.now());
  }

  useEffect(() => {
    loadAttempts();
  }, [userId, quizDay]);

  useEffect(() => {
    lastSubmittedKeyRef.current = null;
    setTimeLeft(30);
    setQuestionStartedAt(Date.now());
  }, [currentIndex, userId]);

  useEffect(() => {
    if (!started || !currentQuestion || loading || submitting || feedback) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);
          submitAnswer(null, true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentQuestion?.key, loading, submitting, feedback]);

  return {
    quizDay,
    questions,
    attempts,
    currentQuestion,
    currentIndex,
    completed,
    correctCount,
    loading,
    error,
    feedback,
    submitting,
    timeLeft,
    started,
    startQuiz,
    submitAnswer,
    refreshQuiz: loadAttempts,
  };
}
