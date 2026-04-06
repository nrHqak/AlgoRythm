import { useLocale } from "../hooks/useLocale.jsx";

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
  const { t } = useLocale();
  const atStart = currentStep <= 0;
  const atEnd = totalSteps === 0 || currentStep >= totalSteps - 1;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{t("playground.player")}</h2>
          <p>{t("playground.playerSubtitle")}</p>
        </div>
      </div>

      <div className="player-controls">
        <button className="secondary-button" type="button" onClick={onPrev} disabled={atStart}>
          ⏮ {t("playground.prev")}
        </button>
        {isPlaying ? (
          <button className="primary-button" type="button" onClick={onPause}>
            ⏸ {t("playground.pause")}
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onPlay} disabled={atEnd}>
            ▶ {t("playground.play")}
          </button>
        )}
        <button className="secondary-button" type="button" onClick={onNext} disabled={atEnd}>
          ⏭ {t("playground.next")}
        </button>
      </div>

      <div className="progress-track" aria-label="Trace progress">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="progress-copy">
        {t("playground.stepOf")} {totalSteps > 0 ? currentStep + 1 : 0} {t("playground.of")} {totalSteps}
      </div>
    </section>
  );
}
