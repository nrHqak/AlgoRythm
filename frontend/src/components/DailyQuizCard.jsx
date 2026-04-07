export function DailyQuizCard({ quiz, loading, error, onAnswer, busy, copy, onOpenPlayground }) {
  if (loading) {
    return (
      <section className="panel ritual-card ritual-quiz-card">
        <div className="ritual-skeleton" />
      </section>
    );
  }

  const progressValue = Math.min(100, (quiz.attempts.length / 3) * 100);

  return (
    <section className="panel ritual-card ritual-quiz-card">
      <div className="panel-header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
        <span className="pill ritual-pill">{quiz.correctCount}/3</span>
      </div>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="ritual-progress-copy">
        <span>{copy.progress.replace("{done}", quiz.attempts.length).replace("{total}", "3")}</span>
        <span>{quiz.completed ? copy.complete : quiz.started ? `${quiz.timeLeft}s` : copy.ready}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressValue}%` }} />
      </div>

      {quiz.feedback ? (
        <div className={`quiz-feedback ${quiz.feedback.correct ? "is-correct" : "is-soft"}`}>
          {quiz.feedback.correct ? copy.correct : quiz.feedback.timedOut ? copy.timeout : copy.incorrect}
          <span>{` +${quiz.feedback.xpEarned} XP`}</span>
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
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
