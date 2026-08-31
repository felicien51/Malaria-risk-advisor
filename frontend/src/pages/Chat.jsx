import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, ApiError } from "../api/client";
import { COUNTIES } from "../data/counties";

const STARTER_PROMPTS = [
  "What does a Moderate risk score mean?",
  "How do I protect my family from malaria?",
  "Why does rainfall affect malaria risk?",
];

export default function Chat() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const countyName = searchParams.get("county") || "";

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const history = nextMessages.slice(0, -1).map(({ role, content }) => ({ role, content }));
      const data = await api.sendChatMessage(trimmed, { countyName, history, token });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the chat assistant. Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "1rem" }}>
        <div className="icon-badge">💬</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            Ask about malaria risk
          </h2>
          <p className="subtitle">Grounded in this app's own risk data and general prevention guidance</p>
        </div>
      </div>

      <div className="chat-county-row">
        <label htmlFor="chat-county-select" style={{ fontSize: "0.85rem", color: "rgba(var(--paper-rgb),0.6)" }}>
          Ask about a specific county (optional):
        </label>
        <select
          id="chat-county-select"
          className="county-select"
          value={countyName}
          onChange={(e) => {
            const value = e.target.value;
            setSearchParams(value ? { county: value } : {});
          }}
        >
          <option value="">No county selected</option>
          {COUNTIES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="panel chat-panel">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <p style={{ color: "rgba(var(--paper-rgb),0.55)", marginBottom: "0.75rem" }}>
                Try asking:
              </p>
              <div className="chat-starter-list">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="icon-btn"
                    onClick={() => send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble chat-bubble-${m.role}`}>
              {m.content}
            </div>
          ))}

          {sending && (
            <div className="chat-bubble chat-bubble-assistant chat-bubble-loading">
              <span className="spinner" style={{ width: "1rem", height: "1rem" }} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && <div className="disclaimer" role="alert">⚠ {error}</div>}

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about malaria risk or prevention…"
            maxLength={1000}
            disabled={sending}
            aria-label="Your question"
          />
          <button className="retry-btn" type="submit" disabled={sending || !input.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>

      <div className="warning-box" style={{ marginTop: "1rem" }}>
        ⚠️ Not a substitute for medical advice — for symptoms or diagnosis, contact a healthcare provider.
      </div>
    </div>
  );
}
