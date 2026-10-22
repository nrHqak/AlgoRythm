import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { CodeEditor } from "../components/CodeEditor";
import { ComplexityChart } from "../components/ComplexityChart";
import { MentorChat } from "../components/MentorChat";
import { StepPlayer } from "../components/StepPlayer";
import { VisualCanvas } from "../components/VisualCanvas";
import { useComplexity } from "../hooks/useComplexity";
import { useAudio } from "../hooks/useAudio";
import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";
import { usePlayer } from "../hooks/usePlayer";
import { usePythonRuntimePrewarm } from "../hooks/usePythonRuntimePrewarm";
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
    key: "selection_sort",
    label: "Selection Sort",
    arrayVar: "arr",
    code: `arr = [5, 3, 1, 4, 2]
for i in range(len(arr)):
    min_idx = i
    for j in range(i + 1, len(arr)):
        if arr[j] < arr[min_idx]:
            min_idx = j
    arr[i], arr[min_idx] = arr[min_idx], arr[i]`,
  },
  {
    key: "insertion_sort",
    label: "Insertion Sort",
    arrayVar: "arr",
    code: `arr = [5, 3, 1, 4, 2]
for i in range(1, len(arr)):
    key = arr[i]
    j = i - 1
    while j >= 0 and arr[j] > key:
        arr[j + 1] = arr[j]
        j -= 1
    arr[j + 1] = key`,
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
    key: "linear_search",
    label: "Linear Search",
    arrayVar: "arr",
    code: `arr = [4, 8, 2, 9, 1]
target = 9
for i in range(len(arr)):
    if arr[i] == target:
        result = i
        break`,
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

function summarizeTraceSteps(steps, count = 5) {
  return JSON.stringify((steps || []).slice(-count), null, 2);
}

function formatAlgorithmLabel(value) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PlaygroundPage({ achievementUi }) {
  const runtimeRef = usePythonRuntimePrewarm();
  const { taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { t } = useLocale();
  const { refreshProfile } = useProfile();
  const { traceData, isLoading, requestError, analyzeCode, resetTrace, waitForClassification, captureExecution, invalidateExecution,
    runtimeStatus, retryRuntime, classificationStatus, canRun } = useTracer({ runtimeRef });
  const { currentStep, isPlaying, play, pause, next, prev, progress } = usePlayer(traceData.total_steps, traceData.steps);
  const { muted, toggleMute, unlockAudio, playSound } = useAudio();

  const [task, setTask] = useState(location.state?.task || null);
  const [loadingTask, setLoadingTask] = useState(Boolean(taskId));
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [arrayVar, setArrayVar] = useState("arr");
  const [selectedExample, setSelectedExample] = useState("bubble_sort");
  const [mentorMessages, setMentorMessages] = useState([]);
  const [mentorInput, setMentorInput] = useState("");
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorError, setMentorError] = useState("");
  const [persistenceLoading, setPersistenceLoading] = useState(false);
  const [postExecutionJob, setPostExecutionJob] = useState(null);
  const sessionTail = useRef(Promise.resolve());
  const activeMentor = useRef(null);
  const preparingRun = useRef(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [xpNotice, setXpNotice] = useState("");
  const savedRunSession = useRef(Promise.resolve(null));
  const [proactiveTriggered, setProactiveTriggered] = useState(false);
  const { complexityData, complexityLoading, complexityError, complexityRuntimeStatus, analyzeComplexity, cancelComplexity } = useComplexity(runtimeRef);
  const canStartRun = canRun || (complexityLoading && runtimeStatus === "running");
  const currentTraceStep =
    traceData.steps.length > 0 ? traceData.steps[Math.min(currentStep, traceData.steps.length - 1)] : null;

  useEffect(() => {
    let active = true;
    async function loadTask() {
      if (!taskId) {
        setTask(null);
        setLoadingTask(false);
        return;
      }

      setLoadingTask(true);
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (!active) return;
      if (error) {
        setSaveError(error.message || "Unable to load task.");
      } else {
        setTask(data || null);
      }
      setLoadingTask(false);
    }

    loadTask().catch((error) => {
      if (active) { setSaveError(error.message || "Unable to load task."); setLoadingTask(false); }
    });
    return () => { active = false; };
  }, [taskId]);

  useEffect(() => {
    if (task?.starter_code) {
      setCode(task.starter_code);
      setSelectedExample("task");
      setArrayVar("arr");
      resetTrace();
      clearSecondaryState();
      cancelComplexity();
      setMentorMessages([]);
      setProactiveTriggered(false);
    }
  }, [task?.id]);

  useEffect(() => {
    const selected = EXAMPLES.find((example) => example.key === selectedExample);
    if (selected && selectedExample !== "task") {
      setCode(selected.code);
      setArrayVar(selected.arrayVar);
      resetTrace();
      clearSecondaryState();
      cancelComplexity();
      setMentorMessages([]);
      setProactiveTriggered(false);
    }
  }, [selectedExample]);

  useEffect(() => {
    if (!currentTraceStep) {
      return;
    }
    // Optional sound must neither delay tracing nor play a retired Run after
    // a suspended audio context finally resumes.
    playSound(currentTraceStep.event, captureExecution()).catch(() => {});
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
            array: currentTraceStep.array,
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

  function clearSecondaryState() {
    activeMentor.current?.controller.abort();
    activeMentor.current = null;
    setMentorLoading(false);
    setMentorError("");
    setPersistenceLoading(false);
    savedRunSession.current = Promise.resolve(null);
    setSaveFeedback("");
    setSaveError("");
    setXpNotice("");
    setProactiveTriggered(false);
  }

  useEffect(() => () => { activeMentor.current?.controller.abort(); }, []);

  async function persistMentorMessage(role, message, triggerType, savedSessionId) {
    if (!user?.id || !message) return;
    const { error } = await supabase.from("mentor_messages").insert({
      user_id: user.id, session_id: savedSessionId, role, message, trigger_type: triggerType,
    });
    if (error) throw error;
  }

  async function sendMentorMessage({
    question, mode, traceOverride, suppressUserMessage = false, userHistory = null,
    context = { code, result: traceData }, isCurrent = captureExecution(),
    savedSession = savedRunSession.current,
  }) {
    if (!isCurrent()) return;
    activeMentor.current?.controller.abort();
    const request = { controller: new AbortController() };
    activeMentor.current = request;
    const current = () => isCurrent() && activeMentor.current === request;
    setMentorLoading(true);
    setMentorError("");
    const trimmedQuestion = question.trim();
    const records = [];
    try {
      if (!suppressUserMessage && trimmedQuestion) {
        setMentorMessages((previous) => [...previous.slice(-9), { role: "user", message: trimmedQuestion }]);
        records.push({ role: "user", message: trimmedQuestion });
      }
      const result = context.result;
      const response = await fetch(getApiUrl("/mentor"), {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.controller.signal,
        body: JSON.stringify({
          code: context.code,
          error: result.error ? `${result.error.type}: ${result.error.message}` : null,
          error_line: result.error?.line || null,
          trace_context: traceOverride || summarizeTraceSteps(result.steps, 5),
          user_question: trimmedQuestion || null, mode, user_history: userHistory,
        }),
      });
      if (!response.ok) throw new Error(`Mentor request failed with status ${response.status}.`);
      const data = await response.json();
      records.push({ role: "mentor", message: data.message });
      if (current()) {
        setMentorMessages((previous) => [...previous.slice(-9), { role: "mentor", message: data.message }]);
      }
    } catch (error) {
      if (current()) setMentorError(error.message || "Mentor request failed.");
    } finally {
      if (current()) { setMentorLoading(false); setMentorInput(""); }
    }
    // Answers can be visible while the matching historical session is saving.
    // A failed session resolves to null; it must never attach a reply to a newer session.
    try {
      const savedSessionId = await savedSession;
      for (const record of records) await persistMentorMessage(record.role, record.message, mode, savedSessionId);
    } catch (error) {
      if (current()) setMentorError(`${t("playground.mentorSaveFailed")} ${error.message || ""}`);
    }
  }

  async function saveSession(result, idempotencyKey) {
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("You must be signed in to save a session.");
    }

    const response = await fetch(getApiUrl("/session/save"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        code,
        array_var: arrayVar,
        trace: result.steps,
        error: result.error,
        total_steps: result.total_steps,
        algorithm_type: result.algorithm_type || task?.expected_algorithm || "custom",
        execution_succeeded: !result.error,
        task_id: task?.id || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Session save failed with status ${response.status}.`);
    }

    return response.json();
  }

  function handleCodeChange(value) {
    setCode(value);
    cancelComplexity();
  }

  function handleArrayVarChange(value) {
    setArrayVar(value);
    cancelComplexity();
  }

  // React runs this effect after the trace has been committed to the DOM.
  // The job captures the code/task/auth inputs from that Run, not later editor state.
  useEffect(() => {
    if (!postExecutionJob || postExecutionJob.started) return;
    postExecutionJob.started = true;
    postExecutionJob.start(); // start owns all success/failure handling below.
  }, [postExecutionJob]);

  async function handleRun() {
    if (!canStartRun || preparingRun.current) return;
    preparingRun.current = true;
    invalidateExecution();
    const preparationCurrent = captureExecution();
    clearSecondaryState();
    // Start under the click gesture, but audio readiness is not a trace dependency.
    unlockAudio().catch(() => null);
    try {
      await cancelComplexity();
      if (!preparationCurrent()) return;
      const result = await analyzeCode(code, arrayVar);
      if (!result) return;
      const isCurrent = captureExecution(result);
      const idempotencyKey = crypto.randomUUID();
      setPostExecutionJob({ started: false, start() {
        if (!isCurrent()) return;
        setPersistenceLoading(true);
        const previousSession = sessionTail.current;
        const sessionWork = Promise.all([waitForClassification(result), previousSession])
          .then(async ([enrichedResult]) => {
            const payload = await saveSession(enrichedResult, idempotencyKey);
            if (isCurrent()) {
              setSaveFeedback(t("playground.sessionSaved"));
              setXpNotice(payload.xp_awarded > 0
                ? t("playground.activityAward").replace("{xp}", String(payload.xp_awarded))
                : t("playground.noActivityAward"));
              achievementUi.pushAchievements(payload.achievements_earned || []);
            }
            return payload;
          });
        // A failed middle Run must not let later saves bypass an older pending save.
        sessionTail.current = Promise.allSettled([previousSession, sessionWork]).then(() => undefined);
        const savedSession = sessionWork.then((payload) => payload.session_id, () => null);
        savedRunSession.current = savedSession;
        sessionWork.then(async () => {
          // Profile XP is cumulative across historical saves. Read fresh global
          // state after each successful save, guarded by the generation current
          // when the read starts plus ProfileProvider's overlapping-read guard.
          const profileCurrent = captureExecution();
          if (profileCurrent()) await refreshProfile({ isCurrent: profileCurrent });
        }).catch((error) => {
          if (isCurrent()) setSaveError(`${t("playground.persistenceFailed")} ${error.message || ""}`);
        }).finally(() => { if (isCurrent()) setPersistenceLoading(false); });
        if (result.error) {
          // Reactive help uses this exact error/code, and starts without waiting
          // for classification, database work, or profile refresh.
          sendMentorMessage({ question: "", mode: "reactive", suppressUserMessage: true,
            context: { code, result }, isCurrent, savedSession });
        }
      } });
    } catch (error) {
      if (preparationCurrent()) setSaveError(error.message || "Unable to prepare execution.");
    } finally {
      preparingRun.current = false;
    }
  }

  if (loadingTask) {
    return <div className="page-loading">{t("playground.loadingTask")}</div>;
  }

  return (
    <div className="signal-page playground-page">
      <section className="hero-banner">
        <div>
          <div className="section-kicker">
            <span aria-hidden="true" />
            {t("playground.eyebrow")}
          </div>
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

      <div className="status-banner" role="status" data-runtime-status={runtimeStatus}>
        {t(`playground.runtime.${runtimeStatus}`)}
        {runtimeStatus === "error" && <>{" "}<button type="button" className="secondary-button" onClick={retryRuntime}>{t("playground.runtimeRetry")}</button></>}
      </div>
      {classificationStatus === "loading" ? (
        <div className="status-banner" role="status">{t("playground.classifying")}</div>
      ) : null}
      {persistenceLoading ? <div className="status-banner" role="status">{t("playground.savingSession")}</div> : null}
      {mentorError ? <div className="status-banner is-error" role="alert">{mentorError}</div> : null}
      {requestError ? <div className="status-banner is-error">{requestError}</div> : null}
      {traceData.truncated ? <div className="status-banner">{t("playground.traceStopped")}</div> : null}
      {saveFeedback ? <div className="status-banner is-success">{saveFeedback}</div> : null}
      {saveError ? <div className="status-banner is-error">{saveError}</div> : null}
      {traceData.algorithm_type ? (
        <div className="status-banner is-success">
          {`${formatAlgorithmLabel(traceData.algorithm_type)} detected`}
        </div>
      ) : null}
      {traceData.error ? (
        <div className="status-banner is-error">{traceData.error.type === "timeout"
          ? traceData.error.message : `${traceData.error.type}: ${traceData.error.message}`}</div>
      ) : null}
      {xpNotice ? <div className="xp-notice inline-success">{xpNotice}</div> : null}

      <div className="playground-layout">
        <div className="playground-primary-grid">
          <div className="playground-editor-zone">
            <CodeEditor
              code={code}
              arrayVar={arrayVar}
              errorLine={traceData.error?.line || null}
              isLoading={isLoading}
              runDisabled={!canStartRun}
              onCodeChange={handleCodeChange}
              onArrayVarChange={handleArrayVarChange}
              onRun={handleRun}
              examples={examples}
              selectedExample={selectedExample}
              onExampleChange={setSelectedExample}
              task={task}
            />
          </div>

          <div className="playground-trace-zone">
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
          </div>
        </div>

        <div className="playground-context-grid">
          <ComplexityChart complexityData={complexityData} isLoading={complexityLoading}
            error={complexityError} onAnalyze={() => analyzeComplexity(code, arrayVar)}
            disabled={complexityRuntimeStatus !== "ready" || isLoading} />
          <MentorChat
            title={t("playground.mentorTitle")}
            subtitle={t("playground.mentorSubtitle")}
            messages={mentorMessages}
            loading={mentorLoading}
            inputValue={mentorInput}
            onInputChange={setMentorInput}
            onSend={() => sendMentorMessage({ question: mentorInput, mode: "free_chat" })}
            disabled={false}
            structured
            note={t("playground.mentorNote")}
          />
        </div>
      </div>
    </div>
  );
}
