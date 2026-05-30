/**
 * Pragmatic email validation. We deliberately avoid the full RFC 5322 grammar
 * (which accepts many addresses no SMTP server will deliver to) in favour of a
 * conservative pattern that matches what mailing tools actually accept.
 */
const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  if (email.length > 254) return false;
  if (email.includes("..")) return false;
  const at = email.indexOf("@");
  if (at < 0) return false;
  const local = email.slice(0, at);
  if (local.length > 64) return false;
  return EMAIL_RE.test(email);
}

/** Ratio (0..1) of values that look like valid emails. */
export function emailMatchRatio(values: string[]): number {
  const nonEmpty = values.filter((v) => v.trim().length > 0);
  if (nonEmpty.length === 0) return 0;
  const valid = nonEmpty.filter((v) => isValidEmail(v.trim())).length;
  return valid / nonEmpty.length;
}
