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
          <div className="empty-state">Your mentor conversation will appear here.</div>
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
              placeholder="Ask about the current step, algorithm ideas, or debugging patterns"
              disabled={disabled || loading}
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ask the mentor"
              disabled={disabled || loading}
            />
          )}
        </div>
        <button className="primary-button" type="submit" disabled={disabled || loading || !inputValue.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
