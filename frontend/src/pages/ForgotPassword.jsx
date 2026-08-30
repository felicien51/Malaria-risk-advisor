import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { isValidEmail } from "../utils/validation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.forgotPassword(email);
      setSent(true);
      // The response message is intentionally generic (doesn't reveal
      // whether the account exists) — shown as-is below.
      void data;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <p className="hero-eyebrow">Reset your password</p>
        <h1 className="auth-title">Forgot password</h1>

        {sent ? (
          <p className="auth-success" role="status">
            If an account exists for that email, we've sent a reset link. Check your inbox.
          </p>
        ) : (
          <>
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-error" : undefined}
            />

            {error && <p className="auth-error" role="alert" id="auth-error">{error}</p>}

            <button className="retry-btn auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
