// Client-side mirrors of the validation rules enforced by the backend
// (backend/app/routes/auth.py). These exist purely for instant UX feedback
// before a round-trip to the API — the backend is always the source of
// truth and re-validates everything. If you change the rule on one side,
// change it on the other.
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

export function isValidUsername(username) {
  return USERNAME_RE.test(username);
}

export function passwordError(password) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}
