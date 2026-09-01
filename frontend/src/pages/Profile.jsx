import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, ApiError } from "../api/client";
import { USERNAME_RE } from "../utils/validation";

export default function Profile() {
  const { user, token, updateUser, logoutEverywhere } = useAuth();

  const [username, setUsername] = useState(user?.username || "");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [loggingOutEverywhere, setLoggingOutEverywhere] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  const usernameChanged = username.trim().toLowerCase() !== (user?.username || "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = username.trim().toLowerCase();
    if (!USERNAME_RE.test(trimmed)) {
      setError("Username must be 3-30 characters: letters, numbers, or underscores only.");
      return;
    }
    if (!usernameChanged) return;

    setSubmitting(true);
    try {
      const updated = await api.updateProfile({ username: trimmed }, token);
      updateUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    setLogoutError(null);
    setLoggingOutEverywhere(true);
    try {
      await logoutEverywhere();
      // logoutEverywhere() clears the session and this component will
      // unmount as ProtectedRoute redirects to /login — nothing else to
      // do here even on success.
    } catch (err) {
      setLogoutError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setLoggingOutEverywhere(false);
    }
  };

  if (!user) {
    return (
      <div className="state-box">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="hero-eyebrow">Account</p>
        <h1 className="auth-title">Profile settings</h1>

        <form onSubmit={handleSubmit} noValidate>
          <label className="auth-label" htmlFor="email">Email</label>
          <input id="email" type="email" value={user.email} disabled readOnly />

          <label className="auth-label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setSuccess(false);
            }}
            required
            autoComplete="username"
            disabled={submitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "profile-error" : undefined}
          />

          {error && <p className="auth-error" role="alert" id="profile-error">{error}</p>}
          {success && <p className="auth-success" role="status">Username updated.</p>}

          <button
            className="retry-btn auth-submit"
            type="submit"
            disabled={submitting || !usernameChanged}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </form>

        <p className="auth-switch">
          Want to change your password? <Link to="/forgot-password">Reset it</Link>
        </p>

        <div className="profile-danger-zone">
          <h2 className="profile-danger-title">Log out everywhere</h2>
          <p className="profile-danger-copy">
            Ends every session for this account, including this one — useful if a device was
            lost or you think someone else has access.
          </p>
          {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
          <button
            type="button"
            className="icon-btn profile-danger-btn"
            onClick={handleLogoutEverywhere}
            disabled={loggingOutEverywhere}
          >
            {loggingOutEverywhere ? "Logging out…" : "Log out on all devices"}
          </button>
        </div>
      </div>
    </div>
  );
}
