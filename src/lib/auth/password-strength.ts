/** A local character-mix guide, not a guess at password entropy or breach status. */
export function passwordStrength(value: string) {
  const checks = [
    { label: "6+ characters", met: value.length >= 6 },
    { label: "Lowercase (a–z)", met: /[a-z]/.test(value) },
    { label: "Uppercase (A–Z)", met: /[A-Z]/.test(value) },
    { label: "Number (0–9)", met: /[0-9]/.test(value) },
    { label: "Special character", met: /[^\p{L}\p{N}\p{M}\s]/u.test(value) },
  ];
  const types = checks.slice(1).filter((check) => check.met).length;
  const repeated = /^(.)\1+$/u.test(value);
  const level = !value ? 0 : value.length < 6 || repeated || types < 2 ? 1
    : value.length >= 12 && types >= 3 ? 4 : value.length >= 8 && types >= 3 ? 3 : 2;
  return { checks, level, label: ["", "Weak", "Fair", "Good", "Strong"][level] };
}
