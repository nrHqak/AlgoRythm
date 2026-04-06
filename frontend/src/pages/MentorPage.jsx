import { useEffect, useMemo, useState } from "react";

import { MentorChat } from "../components/MentorChat";
import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";
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
  const { t } = useLocale();
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

  const summarizedTrace = (selectedSession?.trace || []).slice(-3).map((step) => ({
    step: step.step,
    line: step.line,
    event: step.event,
    highlights: step.highlights,
    array: Array.isArray(step.array) ? step.array.slice(0, 8) : [],
  }));

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
          <h1>{t("mentorPage.title")}</h1>
          <p className="meta-text">{t("mentorPage.subtitle")}</p>
        </div>
        <div className="mentor-mode-tabs">
          <button className="mentor-mode-tab is-active" type="button">
            {t("mentorPage.freeChat")}
          </button>
        </div>
      </section>

      {error ? <div className="status-banner is-error">{error}</div> : null}

      <div className="mentor-layout">
        <aside className="sidebar-panel">
          <div className="mentor-sidebar-header">
            <h2 className="section-title">{t("mentorPage.recentSessions")}</h2>
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
            title={t("mentorPage.chatTitle")}
            subtitle={t("mentorPage.chatSubtitle")}
            messages={currentMessages}
            loading={loading}
            inputValue={input}
            onInputChange={setInput}
            onSend={handleSend}
            disabled={false}
            multiline
            note={t("mentorPage.note")}
          />

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>{t("mentorPage.sessionContext")}</h2>
                <p>{t("mentorPage.sessionContextSubtitle")}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setContextOpen((previous) => !previous)}>
                {contextOpen ? t("mentorPage.hideContext") : t("mentorPage.showContext")}
              </button>
            </div>

            {contextOpen && selectedSession ? (
              <div className="context-grid">
                <div className="context-card">
                  <div className="context-label">{t("mentorPage.code")}</div>
                  <div className="session-code">{selectedSession.code}</div>
                </div>
                <div className="context-card">
                  <div className="context-headline">
                    <div className="context-label">{t("mentorPage.traceSummary")}</div>
                    <span className={`result-pill ${selectedSession.solved ? "is-pass" : "is-fail"}`}>
                      {selectedSession.solved ? t("mentorPage.solved") : t("mentorPage.failed")}
                    </span>
                  </div>
                  <div className="trace-summary-list">
                    {summarizedTrace.map((step) => (
                      <article key={`${step.step}-${step.line}`} className="trace-summary-card">
                        <div className="trace-summary-top">
                          <strong>Step {step.step}</strong>
                          <span className="pill">{t("mentorPage.event")}: {step.event}</span>
                        </div>
                        <div className="trace-summary-meta">{t("mentorPage.line")}: {step.line}</div>
                        <div className="trace-summary-meta">{t("mentorPage.highlights")}: {step.highlights?.join(", ") || "—"}</div>
                        <div className="trace-summary-array">[{step.array.join(", ")}]</div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : contextOpen ? (
              <div className="empty-state">{t("mentorPage.noContext")}</div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
