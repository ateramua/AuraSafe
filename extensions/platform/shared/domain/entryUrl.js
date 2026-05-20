export function normalizeEntryUrl(entry) {
  const raw = String(entry?.url || entry?.website || entry?.displayUrl || '').trim();
  if (!raw) {
    return null;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

export function entryHasLaunchUrl(entry) {
  return Boolean(normalizeEntryUrl(entry));
}
