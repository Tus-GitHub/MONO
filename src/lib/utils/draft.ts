const MAX_AGE = 7 * 24 * 60 * 60_000;

/** Only restore a draft against the exact server version it was edited from. */
export function readDraft(raw: string | null, base: string, now = Date.now()): unknown {
  if (!raw) return undefined;
  try {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || saved.base !== base || !Number.isFinite(saved.savedAt) ||
        saved.savedAt > now || now - saved.savedAt > MAX_AGE) return undefined;
    return saved.value;
  } catch { return undefined; }
}

export function encodeDraft(base: string, value: unknown, now = Date.now()): string {
  return JSON.stringify({ version: 1, base, value, savedAt: now });
}
