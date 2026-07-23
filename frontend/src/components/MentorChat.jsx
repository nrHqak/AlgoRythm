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
  structured = false,
}) {
  const { t } = useLocale();
  function formatTime(value) {
    if (!value) return "NOW";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "NOW";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <section className={`panel mentor-chat${structured ? " is-structured" : ""}`}>
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {note ? <div className="chat-note">{note}</div> : null}

      <div className="chat-list">
        {messages.length === 0 ? (
          <div className="empty-state">{structured ? t("mentorPage.emptyTrace") : t("playground.mentorSubtitle")}</div>
        ) : (
          messages.map((message, index) =>
            structured ? (
              <article
                key={`${message.role}-${index}-${message.message || message.text}`}
                className={`message-block ${message.role === "mentor" ? "is-mentor" : "is-user"}`}
              >
                <header>
                  <span>{message.role === "mentor" ? "MENTOR" : "YOU"}</span>
                  <time dateTime={message.created_at || undefined}>{formatTime(message.created_at)}</time>
                </header>
                <div>{message.message || message.text}</div>
              </article>
            ) : (
              <div
                key={`${message.role}-${index}-${message.message || message.text}`}
                className={`chat-bubble ${message.role === "mentor" ? "is-mentor" : "is-user"}`}
              >
                {message.message || message.text}
              </div>
            )
          )
        )}
        {loading ? <div className="chat-note">{structured ? t("mentorPage.thinking") : "Mentor is thinking..."}</div> : null}
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
