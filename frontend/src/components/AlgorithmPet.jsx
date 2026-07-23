const STAGE_ORDER = [
  { key: "seed", min: 0, waveform: [18, 30, 22, 38, 26, 16, 32] },
  { key: "spark", min: 120, waveform: [22, 48, 30, 66, 38, 54, 24, 42] },
  { key: "sprite", min: 320, waveform: [28, 66, 40, 82, 52, 72, 34, 58, 24] },
  { key: "guardian", min: 700, waveform: [34, 76, 46, 92, 58, 84, 42, 68, 30, 52] },
  { key: "legend", min: 1400, waveform: [42, 88, 54, 100, 70, 92, 50, 78, 38, 64, 30] },
];

export function AlgorithmPet({ pet, loading, error, onFeed, feedBusy, copy }) {
  if (loading) {
    return (
      <section className="panel ritual-card ritual-pet-card">
        <div className="ritual-skeleton" />
      </section>
    );
  }

  const stageIndex = Math.max(0, STAGE_ORDER.findIndex((stage) => stage.key === pet?.stage?.key));
  const stage = STAGE_ORDER[stageIndex];
  const nextStage = STAGE_ORDER[stageIndex + 1];
  const growth = pet?.totalGrowth || 0;
  const nextThreshold = nextStage?.min || stage.min;
  const remaining = nextStage ? Math.max(0, nextThreshold - growth) : 0;

  return (
    <section className="panel ritual-card ritual-pet-card">
      <div className="panel-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <span className="ritual-readout">{copy.stageLabels?.[pet?.stage?.key] || pet?.stage?.label || "Seed"}</span>
      </div>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="pet-stage-grid">
        <div className={`companion-waveform ${pet?.stage?.aura || "is-seed"}`} aria-label={`${pet?.pet_name || "Byte"} signal waveform`}>
          {stage.waveform.map((height, index) => (
            <span key={`${stage.key}-${index}`} style={{ "--signal-height": `${height}%`, "--signal-delay": `${index * 40}ms` }} />
          ))}
        </div>

        <div className="pet-copy">
          <div className="pet-name-row">
            <strong>{pet?.pet_name || "Byte"}</strong>
            <span className="growth-readout">
              {copy.growthLabel} / {growth}{nextStage ? ` / ${nextThreshold}` : ""}
            </span>
          </div>
          <p className="growth-remaining">
            {nextStage
              ? copy.growthTo
                  .replace("{remaining}", String(remaining))
                  .replace("{stage}", copy.stageLabels?.[nextStage.key] || nextStage.key)
              : copy.growthMax}
          </p>

          <div className="pet-stats">
            <div>
              <span>{copy.mood}</span>
              <div className="mini-track"><div className="mini-fill is-mood" style={{ width: `${pet?.mood || 0}%` }} /></div>
            </div>
            <div>
              <span>{copy.energy}</span>
              <div className="mini-track"><div className="mini-fill is-energy" style={{ width: `${pet?.energy || 0}%` }} /></div>
            </div>
            <div>
              <span>{copy.hunger}</span>
              <div className="mini-track"><div className="mini-fill is-hunger" style={{ width: `${100 - (pet?.hunger || 0)}%` }} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="pet-footer">
        <button className="primary-button" type="button" onClick={onFeed} disabled={feedBusy || !pet?.canFeed}>
          {pet?.canFeed ? copy.feedAction : copy.feedDone}
        </button>
        <div className="helper-text">{pet?.canFeed ? copy.feedHint : copy.feedCooldown}</div>
      </div>
    </section>
  );
}
