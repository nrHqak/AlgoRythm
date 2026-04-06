import { useEffect, useRef, useState } from "react";

const getBaseUrl = () => (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function trimMessages(messages) {
  return messages.slice(-10);
}

export function MentorChat({ code, traceError, steps }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const lastAutoHintKey = useRef("");

  const sendMessage = async (userQuestion, isAutomatic = false) => {
    if (!traceError) {
      return;
    }

    if (!isAutomatic && !userQuestion.trim()) {
      return;
    }

    if (!isAutomatic) {
      setMessages((previous) => trimMessages([...previous, { role: "user", text: userQuestion.trim() }]));
      setInput("");
    }

    setLoading(true);

    try {
      const traceContext = JSON.stringify(steps.slice(-3), null, 2);
      const response = await fetch(`${getBaseUrl()}/mentor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          error: `${traceError.type}: ${traceError.message}`,
          error_line: traceError.line,
          trace_context: traceContext,
          user_question: userQuestion,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mentor request failed with status ${response.status}.`);
      }

      const data = await response.json();
      setMessages((previous) =>
        trimMessages([
          ...previous,
          { role: "mentor", text: data.message || "What clue do you notice near the failing line?" },
        ])
      );
    } catch (error) {
      setMessages((previous) =>
        trimMessages([
          ...previous,
          {
            role: "mentor",
            text: `Look at line ${traceError.line}. What is the value of the index at this point?`,
          },
        ])
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!traceError) {
      return;
    }

    const key = `${traceError.type}:${traceError.line}:${traceError.message}`;
    if (lastAutoHintKey.current === key) {
      return;
    }

    lastAutoHintKey.current = key;
    sendMessage("", true);
  }, [traceError, steps, code]);

  return (
    <section className="panel mentor-panel">
      <div className="panel__header">
        <div>
          <h2>AI Mentor</h2>
          <p>Hints stay Socratic and focused on the failing step.</p>
        </div>
      </div>

      <div className="chat-list">
        {messages.length === 0 ? (
          <div className="empty-chat">An error will trigger a mentor hint here.</div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.text}`}
              className={`chat-bubble ${message.role === "mentor" ? "is-mentor" : "is-user"}`}
            >
              {message.text}
            </div>
          ))
        )}
        {loading ? <div className="chat-loading">Mentor is thinking...</div> : null}
      </div>

      <form
        className="chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input, false);
        }}
      >
        <input
          className="text-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a follow-up question"
          disabled={!traceError || loading}
        />
        <button className="primary-button" type="submit" disabled={!traceError || loading || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
