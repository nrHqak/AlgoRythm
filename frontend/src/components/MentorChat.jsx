import { useLocale } from "../hooks/useLocale.jsx";

export function MentorChat({
  title = "AI Mentor",
  subtitle = "Ask conceptual questions or get hints about the current trace.",
  messages,
  loading,
  inputValue,
  onInputChange,
  onSend,
  disabled,
  multiline = true,
  note,
}) {
  const { t } = useLocale();
  return (
    <section className="panel mentor-chat">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {note ? <div className="chat-note">{note}</div> : null}

      <div className="chat-list">
        {messages.length === 0 ? (
          <div className="empty-state">{t("playground.mentorSubtitle")}</div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.message || message.text}`}
              className={`chat-bubble ${message.role === "mentor" ? "is-mentor" : "is-user"}`}
            >
              {message.message || message.text}
            </div>
          ))
        )}
        {loading ? <div className="chat-note">Mentor is thinking...</div> : null}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="field">
          {multiline ? (
            <textarea
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={t("playground.askPlaceholder")}
              disabled={disabled || loading}
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={t("playground.askPlaceholder")}
              disabled={disabled || loading}
            />
          )}
        </div>
        <button className="primary-button" type="submit" disabled={disabled || loading || !inputValue.trim()}>
          {t("common.send")}
        </button>
      </form>
    </section>
  );
}
