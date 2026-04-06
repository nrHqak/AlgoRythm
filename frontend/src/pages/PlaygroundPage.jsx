import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { CodeEditor } from "../components/CodeEditor";
import { MentorChat } from "../components/MentorChat";
import { StepPlayer } from "../components/StepPlayer";
import { VisualCanvas } from "../components/VisualCanvas";
import { useAudio } from "../hooks/useAudio";
import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";
import { usePlayer } from "../hooks/usePlayer";
import { useProfile } from "../hooks/useProfile.jsx";
import { useTracer } from "../hooks/useTracer";
import { supabase } from "../lib/supabase";

const EXAMPLES = [
  {
    key: "bubble_sort",
    label: "Bubble Sort",
    arrayVar: "arr",
    code: `arr = [5, 3, 1, 4, 2]
for i in range(len(arr)):
    for j in range(0, len(arr) - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]`,
  },
  {
    key: "binary_search",
    label: "Binary Search",
    arrayVar: "arr",
    code: `arr = [1, 3, 5, 7, 9, 11]
target = 7
left = 0
right = len(arr) - 1

while left <= right:
    mid = (left + right) // 2
    if arr[mid] == target:
        result = mid
        break
    if arr[mid] < target:
        left = mid + 1
    else:
        right = mid - 1`,
  },
  {
    key: "index_error",
    label: "IndexError Demo",
    arrayVar: "arr",
    code: `arr = [1, 2, 3]
print(arr[5])`,
  },
];

function getApiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

function detectAlgorithmType(code, task) {
  if (task?.expected_algorithm) {
    return task.expected_algorithm;
  }

  const normalized = code.toLowerCase();
  if (normalized.includes("bubble")) return "bubble_sort";
  if (normalized.includes("binary")) return "binary_search";
  if (normalized.includes("insertion")) return "insertion_sort";
  if (normalized.includes("target")) return "search";
  return "custom";
}

function summarizeTraceSteps(steps, count = 5) {
  return JSON.stringify((steps || []).slice(-count), null, 2);
}

export function PlaygroundPage({ achievementUi }) {
  const { taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();
  const { refreshProfile } = useProfile();
  const { traceData, isLoading, requestError, analyzeCode, resetTrace } = useTracer();
  const { currentStep, isPlaying, play, pause, next, prev, progress } = usePlayer(traceData.total_steps);
  const { muted, toggleMute, unlockAudio, playSound } = useAudio();

  const [task, setTask] = useState(location.state?.task || null);
  const [loadingTask, setLoadingTask] = useState(Boolean(taskId));
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [arrayVar, setArrayVar] = useState("arr");
  const [selectedExample, setSelectedExample] = useState("bubble_sort");
  const [mentorMessages, setMentorMessages] = useState([]);
  const [mentorInput, setMentorInput] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [xpNotice, setXpNotice] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [proactiveTriggered, setProactiveTriggered] = useState(false);
  const [mentorMessageCount, setMentorMessageCount] = useState(0);
  const currentTraceStep =
    traceData.steps.length > 0 ? traceData.steps[Math.min(currentStep, traceData.steps.length - 1)] : null;

  useEffect(() => {
    async function loadTask() {
      if (!taskId) {
        setTask(null);
        setLoadingTask(false);
        return;
      }

      setLoadingTask(true);
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (error) {
        setSaveError(error.message || "Unable to load task.");
      } else {
        setTask(data || null);
      }
      setLoadingTask(false);
    }

    loadTask();
  }, [taskId]);

  useEffect(() => {
    if (task?.starter_code) {
      setCode(task.starter_code);
      setSelectedExample("task");
      setArrayVar("arr");
      resetTrace();
      setMentorMessages([]);
      setMentorMessageCount(0);
      setProactiveTriggered(false);
    }
  }, [task?.id]);

  useEffect(() => {
    const selected = EXAMPLES.find((example) => example.key === selectedExample);
    if (selected && selectedExample !== "task") {
      setCode(selected.code);
      setArrayVar(selected.arrayVar);
      resetTrace();
      setMentorMessages([]);
      setMentorMessageCount(0);
      setProactiveTriggered(false);
    }
  }, [selectedExample]);

  useEffect(() => {
    if (!currentTraceStep) {
      return;
    }
    playSound(currentTraceStep.event);
  }, [currentStep, currentTraceStep]);

  useEffect(() => {
    if (!traceData.steps.length || proactiveTriggered || !currentTraceStep || !isPlaying) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      sendMentorMessage({
        question: "",
        mode: "proactive",
        traceOverride: JSON.stringify(
          {
            event: currentTraceStep.event,
            line: currentTraceStep.line,
            locals: currentTraceStep.locals,
          },
          null,
          2
        ),
        suppressUserMessage: true,
      });
      setProactiveTriggered(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [currentStep, isPlaying, proactiveTriggered, traceData.steps.length]);

  useEffect(() => {
    if (!xpNotice) {
      return undefined;
    }
    const timer = window.setTimeout(() => setXpNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [xpNotice]);

  const examples = (() => {
    const base = [...EXAMPLES];
    if (task) {
      return [{ key: "task", label: `${task.title} Starter`, arrayVar: "arr", code: task.starter_code }, ...base];
    }
    return base;
  })();

  async function persistMentorMessage(role, message, triggerType, sessionOverride = null) {
    if (!user?.id || !message) {
      return;
    }

    await supabase.from("mentor_messages").insert({
      user_id: user.id,
      session_id: sessionOverride || sessionId,
      role,
      message,
      trigger_type: triggerType,
    });
  }

  async function sendMentorMessage({
    question,
    mode,
    traceOverride,
    suppressUserMessage = false,
    userHistory = null,
    sessionOverride = null,
  }) {
    setMentorLoading(true);
    setSaveError("");
        const trimmedQuestion = question.trim();

    try {
      if (!suppressUserMessage && trimmedQuestion) {
        const userMessage = { role: "user", message: trimmedQuestion };
        setMentorMessages((previous) => [...previous.slice(-9), userMessage]);
        setMentorMessageCount((previous) => previous + 1);
        await persistMentorMessage("user", trimmedQuestion, mode, sessionOverride);
      }

      const response = await fetch(getApiUrl("/mentor"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          error: traceData.error ? `${traceData.error.type}: ${traceData.error.message}` : null,
          error_line: traceData.error?.line || null,
          trace_context: traceOverride || summarizeTraceSteps(traceData.steps, 5),
          user_question: trimmedQuestion || null,
          mode,
          user_history: userHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mentor request failed with status ${response.status}.`);
      }

      const data = await response.json();
      const mentorMessage = { role: "mentor", message: data.message };
      setMentorMessages((previous) => [...previous.slice(-9), mentorMessage]);
      setMentorMessageCount((previous) => previous + 1);
      await persistMentorMessage("mentor", data.message, mode, sessionOverride);
    } catch (error) {
      setSaveError(error.message || "Mentor request failed.");
    } finally {
      setMentorLoading(false);
      setMentorInput("");
    }
  }

  async function getTaskProgressContext() {
    if (!task || !user?.id) {
      return { existing: null, completedFirstTime: false, attempts: 1 };
    }

    const { data: existing } = await supabase
      .from("task_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("task_id", task.id)
      .maybeSingle();

    const attempts = (existing?.attempts || 0) + 1;
    return {
      existing: existing || null,
      completedFirstTime: existing?.status !== "completed",
      attempts,
    };
  }

  async function saveTaskProgress({ solved, steps, xpEarned, context }) {
    if (!task || !user?.id) {
      return { completedFirstTime: false, attempts: 1 };
    }

    const existing = context.existing;
    const attempts = (existing?.attempts || 0) + 1;
    const completedFirstTime = solved && existing?.status !== "completed";
    const payload = {
      user_id: user.id,
      task_id: task.id,
      status: solved ? "completed" : existing?.status || (task.order_index === 1 ? "unlocked" : "locked"),
      attempts,
      best_steps: solved ? Math.min(existing?.best_steps || steps, steps) : existing?.best_steps || null,
      xp_earned: (existing?.xp_earned || 0) + (solved ? xpEarned : 0),
      completed_at: solved ? new Date().toISOString() : existing?.completed_at || null,
    };

    const { error } = await supabase.from("task_progress").upsert(payload, {
      onConflict: "user_id,task_id",
    });

    if (error) {
      throw error;
    }

    if (solved) {
      const { data: nextTask } = await supabase
        .from("tasks")
        .select("*")
        .eq("order_index", task.order_index + 1)
        .maybeSingle();

      if (nextTask) {
        await supabase.from("task_progress").upsert(
          {
            user_id: user.id,
            task_id: nextTask.id,
            status: "unlocked",
          },
          { onConflict: "user_id,task_id" }
        );
      }
    }

    return { completedFirstTime, attempts };
  }

  async function saveSession(result, xpEarned, taskContext) {
    const response = await fetch(getApiUrl("/session/save"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        code,
        array_var: arrayVar,
        trace: result.steps,
        error: result.error,
        total_steps: result.total_steps,
        algorithm_type: detectAlgorithmType(code, task),
        solved: !result.error,
        xp_earned: xpEarned,
        task_id: task?.id || null,
        task_completed: taskContext.completedFirstTime,
        task_attempts: taskContext.attempts,
        mentor_messages_count: mentorMessageCount,
      }),
    });

    if (!response.ok) {
      throw new Error(`Session save failed with status ${response.status}.`);
    }

    return response.json();
  }

  async function handleRun() {
    await unlockAudio();
    setSaveFeedback("");
    setSaveError("");
    setXpNotice("");
    setProactiveTriggered(false);

    const result = await analyzeCode(code, arrayVar);
    if (!result) {
      return;
    }

    try {
      const solved = !result.error;
      const steps = result.total_steps || 0;
      const taskContext = await getTaskProgressContext();

      let xpEarned = solved ? 30 : 10;
      if (solved && task && taskContext.completedFirstTime) {
        xpEarned += task.max_xp || 0;
        if (mentorMessageCount === 0) {
          xpEarned += 50;
        }
        if (taskContext.attempts <= 3) {
          xpEarned += 30;
        }
      }

      await saveTaskProgress({ solved, steps, xpEarned, context: taskContext });
      const savePayload = await saveSession(result, xpEarned, taskContext);
      setSessionId(savePayload.session_id);
      setSaveFeedback(solved ? t("playground.sessionSaved") : t("playground.errorSaved"));
      setXpNotice(`+${xpEarned} XP earned!`);
      achievementUi.pushAchievements(savePayload.achievements_earned || []);
      await refreshProfile();

      if (result.error) {
        await sendMentorMessage({
          question: "",
          mode: "reactive",
          traceOverride: summarizeTraceSteps(result.steps, 5),
          suppressUserMessage: true,
          sessionOverride: savePayload.session_id,
        });
      }
    } catch (error) {
      setSaveError(error.message || "Unable to save session.");
    }
  }

  if (loadingTask) {
    return <div className="page-loading">{t("playground.loadingTask")}</div>;
  }

  return (
    <>
      <section className="hero-banner">
        <div>
          <div className="eyebrow">{t("playground.eyebrow")}</div>
          <h1>{t("playground.title")}</h1>
          <p className="meta-text">{t("playground.subtitle")}</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={toggleMute}>
            {muted ? t("playground.unmute") : t("playground.mute")}
          </button>
          {task ? (
            <button className="ghost-button" type="button" onClick={() => navigate("/learn")}>
              {t("playground.backToCurriculum")}
            </button>
          ) : null}
        </div>
      </section>

      {requestError ? <div className="status-banner is-error">{requestError}</div> : null}
      {traceData.truncated ? <div className="status-banner">{t("playground.traceStopped")}</div> : null}
      {saveFeedback ? <div className="status-banner is-success">{saveFeedback}</div> : null}
      {saveError ? <div className="status-banner is-error">{saveError}</div> : null}
      {traceData.error?.type === "timeout" ? (
        <div className="status-banner is-error">{traceData.error.message}</div>
      ) : null}
      {xpNotice ? <div className="xp-notice inline-success">{xpNotice}</div> : null}

      <div className="playground-layout">
        <div className="panel-stack">
          <CodeEditor
            code={code}
            arrayVar={arrayVar}
            errorLine={traceData.error?.line || null}
            isLoading={isLoading}
            onCodeChange={setCode}
            onArrayVarChange={setArrayVar}
            onRun={handleRun}
            examples={examples}
            selectedExample={selectedExample}
            onExampleChange={setSelectedExample}
            task={task}
          />
        </div>

        <div className="panel-stack">
          <VisualCanvas step={currentTraceStep} totalSteps={traceData.total_steps} />
          <StepPlayer
            currentStep={currentStep}
            totalSteps={traceData.total_steps}
            isPlaying={isPlaying}
            progress={progress}
            onPrev={prev}
            onPlay={play}
            onPause={pause}
            onNext={next}
          />
          <MentorChat
            messages={mentorMessages}
            loading={mentorLoading}
            inputValue={mentorInput}
            onInputChange={setMentorInput}
            onSend={() => sendMentorMessage({ question: mentorInput, mode: "free_chat" })}
            disabled={false}
            note={t("playground.mentorNote")}
          />
        </div>
      </div>
    </>
  );
}
