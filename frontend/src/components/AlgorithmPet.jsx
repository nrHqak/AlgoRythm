export function AlgorithmPet({ pet, loading, error, onFeed, feedBusy, copy }) {
  if (loading) {
    return (
      <section className="panel ritual-card ritual-pet-card">
        <div className="ritual-skeleton" />
      </section>
    );
  }

  return (
    <section className="panel ritual-card ritual-pet-card">
      <div className="panel-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <span className="pill ritual-pill">{copy.stageLabels?.[pet?.stage?.key] || pet?.stage?.label || "Seed"}</span>
      </div>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="pet-stage-grid">
        <div className={`pet-avatar ${pet?.stage?.aura || "is-seed"}`}>
          <span>{pet?.stage?.emoji || "·:･ﾟ✧"}</span>
        </div>

        <div className="pet-copy">
          <div className="pet-name-row">
            <strong>{pet?.pet_name || "Byte"}</strong>
            <span className="meta-text">{copy.growthLabel}: {pet?.totalGrowth || 0}</span>
          </div>
          <p className="helper-text">
            {copy.stageIntro.replace("{stage}", copy.stageLabels?.[pet?.stage?.key] || pet?.stage?.label || "Seed")}
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
