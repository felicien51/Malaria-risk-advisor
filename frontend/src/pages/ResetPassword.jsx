import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { passwordError } from "../utils/validation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const emailFromLink = searchParams.get("email") || "";
  const tokenFromLink = searchParams.get("token") || "";

  const [email, setEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!tokenFromLink) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    const pwError = passwordError(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(email, tokenFromLink, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <p className="hero-eyebrow">Almost there</p>
        <h1 className="auth-title">Set a new password</h1>

        {done ? (
          <p className="auth-success" role="status">
            Password updated.{" "}
            <button
              type="button"
              className="auth-forgot-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              onClick={() => navigate("/login")}
            >
              Log in now
            </button>
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
              disabled={submitting}
            />

            <label className="auth-label" htmlFor="password">New password</label>
            <div className="auth-password-row">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
                disabled={submitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "auth-error" : undefined}
              />
              <button
                type="button"
                className="auth-toggle-visibility"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <p className="auth-hint">At least 8 characters.</p>

            {error && <p className="auth-error" role="alert" id="auth-error">{error}</p>}

            <button className="retry-btn auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save new password"}
            </button>
          </>
        )}

        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  );
}
