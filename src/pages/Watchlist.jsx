import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, ApiError } from "../api/client";
import { COUNTIES } from "../data/counties";

const LEVEL_COLOR = { Low: "var(--risk-low)", Moderate: "var(--risk-moderate)", High: "var(--risk-high)" };

export default function Watchlist() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    setStatus("loading");
    api
      .listWatchlist(token)
      .then((data) => {
        setItems(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load your watchlist.");
        setStatus("error");
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedCounty) return;
    setAdding(true);
    setError(null);
    try {
      await api.addToWatchlist(selectedCounty, token);
      setSelectedCounty("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add that county.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id) => {
    setError(null);
    try {
      await api.removeFromWatchlist(id, token);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that county.");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValue("");
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const handleSaveEdit = async (id) => {
    if (!editValue) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await api.updateWatchlistItem(id, editValue, token);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated, latest: i.latest } : i)));
      setEditingId(null);
      setEditValue("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that entry.");
    } finally {
      setSavingEdit(false);
    }
  };

  const watchedNames = new Set(items.map((i) => i.county_name));
  const availableCounties = COUNTIES.filter((c) => !watchedNames.has(c.name));

  return (
    <div>
      <div className="dash-title" style={{ marginBottom: "1rem" }}>
        <div className="icon-badge">📌</div>
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", margin: 0 }}>
            Your watchlist
          </h2>
          <p className="subtitle">Saved counties, synced to your account</p>
        </div>
      </div>

      <form className="watchlist-add-row" onSubmit={handleAdd}>
        <select
          className="county-select"
          value={selectedCounty}
          onChange={(e) => setSelectedCounty(e.target.value)}
        >
          <option value="">Add a county…</option>
          {availableCounties.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button className="retry-btn" type="submit" disabled={!selectedCounty || adding}>
          {adding ? "Adding…" : "+ Add"}
        </button>
      </form>

      {error && <div className="disclaimer" role="alert">⚠ {error}</div>}

      {status === "loading" && (
        <div className="state-box">
          <div className="spinner" />
        </div>
      )}

      {status === "success" && items.length === 0 && (
        <p className="county-count">Nothing saved yet — add a county above.</p>
      )}

      {status === "success" && items.length > 0 && (
        <div className="watchlist-grid">
          {items.map((item) => {
            const latest = item.latest;
            const isEditing = editingId === item.id;
            // Swapping a saved county to one already on the list would collide
            // with the backend's uniqueness rule, so it's excluded here too.
            const swapOptions = COUNTIES.filter(
              (c) => c.name === item.county_name || !watchedNames.has(c.name)
            );

            return (
              <div className="panel watchlist-card" key={item.id}>
                <div className="panel-header">
                  <span className="title">{item.county_name}</span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      className="icon-btn"
                      onClick={() => (isEditing ? cancelEdit() : startEdit(item))}
                      aria-label={isEditing ? "Cancel edit" : `Change county for this entry`}
                    >
                      {isEditing ? "✕" : "✎"}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleRemove(item.id)}
                      aria-label={`Remove ${item.county_name} from watchlist`}
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <select
                      className="county-select"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Change to…</option>
                      {swapOptions.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      className="retry-btn"
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={!editValue || savingEdit}
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : latest ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span
                      className="risk-pill"
                      style={{ color: LEVEL_COLOR[latest.level], background: "rgba(255,255,255,0.06)" }}
                    >
                      {latest.level} · {latest.score}
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "rgba(var(--paper-rgb),0.5)" }}>
                      last checked {new Date(latest.recorded_at).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.85rem", color: "rgba(var(--paper-rgb),0.55)" }}>
                    No history yet — view this county's dashboard to log a reading.
                  </p>
                )}

                {!isEditing && (
                  <button
                    className="retry-btn"
                    style={{ marginTop: "0.75rem" }}
                    onClick={() => navigate(`/county/${encodeURIComponent(item.county_name)}`)}
                  >
                    View dashboard →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
