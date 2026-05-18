const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidEmail(email) {
  if (!isNonEmptyString(email)) return false;
  const s = email.trim();
  return s.length <= 150 && EMAIL_RE.test(s);
}

function validatePassword(password, { minLength = 6 } = {}) {
  if (typeof password !== 'string' || password.length < minLength) {
    return { ok: false, error: `Password must be at least ${minLength} characters` };
  }
  if (password.length > 200) {
    return { ok: false, error: 'Password is too long' };
  }
  return { ok: true };
}

const ALLOWED_ROLES = ['tenant', 'manager', 'admin', 'landlord'];

function isAllowedRole(role) {
  return ALLOWED_ROLES.includes(role);
}

module.exports = {
  isNonEmptyString,
  isValidEmail,
  validatePassword,
  isAllowedRole,
  ALLOWED_ROLES,
};
