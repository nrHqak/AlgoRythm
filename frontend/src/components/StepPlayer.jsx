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
  const isAtStart = currentStep <= 0;
  const isAtEnd = totalSteps === 0 || currentStep >= totalSteps - 1;

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Player</h2>
          <p>Move through the trace manually or let it animate.</p>
        </div>
      </div>

      <div className="player-controls">
        <button className="secondary-button" type="button" onClick={onPrev} disabled={isAtStart}>
          ⏮ Prev
        </button>
        {isPlaying ? (
          <button className="primary-button" type="button" onClick={onPause}>
            ⏸ Pause
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onPlay} disabled={isAtEnd}>
            ▶ Play
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onNext} disabled={isAtEnd}>
          ⏭ Next
        </button>
      </div>

      <div className="progress-track" aria-label="Playback progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="player-meta">
        Step {totalSteps > 0 ? currentStep + 1 : 0} of {totalSteps}
      </div>
    </section>
  );
}
