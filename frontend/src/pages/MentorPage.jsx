import { useEffect, useMemo, useState } from "react";

import { MentorChat } from "../components/MentorChat";
import { useAuth } from "../hooks/useAuth.jsx";
import { supabase } from "../lib/supabase";

function getApiUrl(path) {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${path}`;
}

function buildUserHistory(sessions) {
  return sessions
    .map(
      (session) =>
        `${session.algorithm_type || "custom"} on ${new Date(session.created_at).toLocaleDateString()} · ${
          session.solved ? "solved" : "error"
        } · ${session.error?.type || "no_error"}`
    )
    .join("\n");
}

export function MentorPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMentorContext() {
      setError("");
      try {
        const [sessionsRes, messagesRes] = await Promise.all([
          supabase.from("sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("mentor_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(50),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (messagesRes.error) throw messagesRes.error;

        const nextSessions = sessionsRes.data || [];
        setSessions(nextSessions);
        setSelectedSession(nextSessions[0] || null);
        setMessages(messagesRes.data || []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load mentor workspace.");
      }
    }

    if (user?.id) {
      loadMentorContext();
    }
  }, [user?.id]);

  const currentMessages = useMemo(() => {
    if (!selectedSession) {
      return messages;
    }
    return messages.filter((message) => !message.session_id || message.session_id === selectedSession.id);
  }, [messages, selectedSession]);

  async function persistMessage(role, message, triggerType) {
    await supabase.from("mentor_messages").insert({
      user_id: user.id,
      session_id: selectedSession?.id || null,
      role,
      message,
      trigger_type: triggerType,
    });
  }

  async function handleSend() {
    const question = input.trim();
    if (!question) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userMessage = { role: "user", message: question, session_id: selectedSession?.id || null };
      setMessages((previous) => [...previous, userMessage]);
      await persistMessage("user", question, "free_chat");

      const response = await fetch(getApiUrl("/mentor"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: selectedSession?.code || "",
          error: selectedSession?.error ? `${selectedSession.error.type}: ${selectedSession.error.message}` : null,
          error_line: selectedSession?.error?.line || null,
          trace_context: JSON.stringify((selectedSession?.trace || []).slice(-5), null, 2),
          user_question: question,
          mode: "free_chat",
          user_history: buildUserHistory(sessions),
        }),
      });

      if (!response.ok) {
        throw new Error(`Mentor request failed with status ${response.status}.`);
      }

      const data = await response.json();
      const mentorMessage = { role: "mentor", message: data.message, session_id: selectedSession?.id || null };
      setMessages((previous) => [...previous, mentorMessage]);
      await persistMessage("mentor", data.message, "free_chat");
      setInput("");
    } catch (requestError) {
      setError(requestError.message || "Unable to send mentor question.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="hero-banner">
        <div>
          <div className="eyebrow">Mentor Studio</div>
          <h1>Ask deeper questions about strategies, complexity, and debugging habits.</h1>
          <p className="meta-text">
            The mentor can use your recent sessions as context, not just the latest error.
          </p>
        </div>
        <div className="mentor-mode-tabs">
          <button className="mentor-mode-tab is-active" type="button">
            Free Chat
          </button>
        </div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="mentor-layout">
        <aside className="sidebar-panel">
          <div className="mentor-sidebar-header">
            <h2 className="section-title">Recent Sessions</h2>
          </div>
          <div className="mentor-session-list">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`mentor-session-card${selectedSession?.id === session.id ? " is-active" : ""}`}
                onClick={() => setSelectedSession(session)}
              >
                <div className="session-title">{session.algorithm_type || "custom"}</div>
                <div className="session-meta">{new Date(session.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="panel-stack">
          <MentorChat
            title="Deep Mentor Chat"
            subtitle="Discuss differences between algorithms, interview prep, or patterns in your recent mistakes."
            messages={currentMessages}
            loading={loading}
            inputValue={input}
            onInputChange={setInput}
            onSend={handleSend}
            disabled={false}
            multiline
            note="Conceptual questions get concise explanations. Debugging questions stay Socratic."
          />

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Session Context</h2>
                <p>Toggle the selected session's code and trace summary.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setContextOpen((previous) => !previous)}>
                {contextOpen ? "Hide Context" : "Show Context"}
              </button>
            </div>

            {contextOpen && selectedSession ? (
              <div className="stack">
                <div className="session-code">{selectedSession.code}</div>
                <div className="session-code">{JSON.stringify((selectedSession.trace || []).slice(-5), null, 2)}</div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
