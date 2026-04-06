import { useEffect, useState } from "react";

import "./App.css";
import { CodeEditor } from "./components/CodeEditor";
import { MentorChat } from "./components/MentorChat";
import { StepPlayer } from "./components/StepPlayer";
import { VisualCanvas } from "./components/VisualCanvas";
import { useAudio } from "./hooks/useAudio";
import { usePlayer } from "./hooks/usePlayer";
import { useTracer } from "./hooks/useTracer";

const INITIAL_CODE = `arr = [5, 3, 1, 4, 2]
for i in range(len(arr)):
    for j in range(0, len(arr) - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]`;

export default function App() {
  const [code, setCode] = useState(INITIAL_CODE);
  const [arrayVar, setArrayVar] = useState("arr");
  const { traceData, isLoading, requestError, analyzeCode } = useTracer();
  const { currentStep, isPlaying, play, pause, next, prev, progress } = usePlayer(traceData.total_steps);
  const { muted, toggleMute, unlockAudio, playSound } = useAudio();

  const currentTraceStep =
    traceData.steps.length > 0 ? traceData.steps[Math.min(currentStep, traceData.steps.length - 1)] : null;

  useEffect(() => {
    if (!currentTraceStep) {
      return;
    }
    playSound(currentTraceStep.event);
  }, [currentStep, currentTraceStep, playSound]);

  const handleRun = async () => {
    await unlockAudio();
    await analyzeCode(code, arrayVar);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <div className="eyebrow">AlgoRythm MVP</div>
          <h1>Trace Python algorithms as motion, sound, and guided questions.</h1>
          <p>
            Paste student code, generate an execution trace, animate each array mutation, and ask the mentor for
            Socratic hints when something breaks.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={toggleMute}>
          {muted ? "Unmute audio" : "Mute audio"}
        </button>
      </header>

      {requestError ? <div className="status-banner is-error">{requestError}</div> : null}
      {traceData.error?.type === "timeout" ? (
        <div className="status-banner is-error">{traceData.error.message}</div>
      ) : null}
      {traceData.truncated ? (
        <div className="status-banner">Trace stopped after 300 recorded steps.</div>
      ) : null}

      <main className="layout-grid">
        <div className="layout-column">
          <CodeEditor
            code={code}
            arrayVar={arrayVar}
            errorLine={traceData.error?.line || null}
            isLoading={isLoading}
            onCodeChange={setCode}
            onArrayVarChange={setArrayVar}
            onRun={handleRun}
          />
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

        <div className="layout-column">
          <VisualCanvas step={currentTraceStep} totalSteps={traceData.total_steps} />
          <MentorChat code={code} traceError={traceData.error} steps={traceData.steps} />
        </div>
      </main>
    </div>
  );
}
