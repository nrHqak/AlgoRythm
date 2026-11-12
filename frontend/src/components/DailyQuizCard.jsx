export function DailyQuizCard({ quiz, loading, error, onAnswer, busy, copy, onOpenPlayground }) {
  if (loading) {
    return (
      <section className="panel ritual-card ritual-quiz-card">
        <div className="ritual-skeleton" />
      </section>
    );
  }

  const progressValue = Math.min(100, (quiz.attempts.length / 3) * 100);
  const timeProgress = quiz.started && !quiz.completed ? Math.max(0, Math.min(100, (quiz.timeLeft / 30) * 100)) : 100;

  return (
    <section className="panel ritual-card ritual-quiz-card">
      <div className="panel-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <span className="ritual-readout">{quiz.correctCount}/3</span>
      </div>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="calibration-nodes" aria-label={copy.progress.replace("{done}", quiz.attempts.length).replace("{total}", "3")}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`calibration-node${index < quiz.attempts.length ? " is-complete" : ""}${index === quiz.currentIndex && quiz.started ? " is-current" : ""}`}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
      <div className="countdown-readout">
        <span>{copy.progress.replace("{done}", quiz.attempts.length).replace("{total}", "3")}</span>
        <strong>{quiz.completed ? copy.complete : quiz.started ? `${String(quiz.timeLeft).padStart(2, "0")}s` : copy.ready}</strong>
      </div>
      <div className="countdown-rail" aria-hidden="true">
        <div className="countdown-fill" style={{ width: `${quiz.started ? timeProgress : progressValue}%` }} />
      </div>

      {quiz.feedback ? (
        <div className={`quiz-feedback ${quiz.feedback.correct ? "is-correct" : "is-soft"}`}>
          {quiz.feedback.correct ? copy.correct : quiz.feedback.timedOut ? copy.timeout : copy.incorrect}
          <span>{copy.practiceOnly}</span>
        </div>
      ) : null}

      {quiz.completed ? (
        <div className="quiz-complete-state">
          <strong>{copy.completeTitle}</strong>
          <p>{copy.completeText.replace("{score}", String(quiz.correctCount))}</p>
          <button className="secondary-button" type="button" onClick={onOpenPlayground}>
            {copy.playgroundCta}
          </button>
        </div>
      ) : !quiz.started ? (
        <div className="quiz-complete-state">
          <strong>{copy.startTitle}</strong>
          <p>{copy.startText}</p>
          <button className="primary-button" type="button" onClick={quiz.startQuiz}>
            {copy.startAction}
          </button>
        </div>
      ) : (
        <>
          <div className="quiz-question-card">
            <div className="meta-text">{copy.questionLabel.replace("{index}", String(quiz.currentIndex + 1))}</div>
            <h3>{quiz.currentQuestion?.prompt}</h3>
          </div>

          <div className="quiz-options">
            {(quiz.currentQuestion?.options || []).map((option, index) => (
              <button
                key={option}
                type="button"
                className="quiz-option"
                onClick={() => onAnswer(index)}
                disabled={busy || Boolean(quiz.feedback)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{option}</strong>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
