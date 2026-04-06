export function StepPlayer({
  currentStep,
  totalSteps,
  isPlaying,
  progress,
  onPrev,
  onPlay,
  onPause,
  onNext,
}) {
  const atStart = currentStep <= 0;
  const atEnd = totalSteps === 0 || currentStep >= totalSteps - 1;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Player</h2>
          <p>Step through the trace manually or let the animation run.</p>
        </div>
      </div>

      <div className="player-controls">
        <button className="secondary-button" type="button" onClick={onPrev} disabled={atStart}>
          ⏮ Prev
        </button>
        {isPlaying ? (
          <button className="primary-button" type="button" onClick={onPause}>
            ⏸ Pause
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onPlay} disabled={atEnd}>
            ▶ Play
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onNext} disabled={atEnd}>
          ⏭ Next
        </button>
      </div>

      <div className="progress-track" aria-label="Trace progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="progress-copy">
        Step {totalSteps > 0 ? currentStep + 1 : 0} of {totalSteps}
      </div>
    </section>
  );
}
