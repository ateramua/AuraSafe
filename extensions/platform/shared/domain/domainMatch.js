export function normalizeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function normalizeHost(value) {
  if (!value) {
    return '';
  }
  const url = normalizeUrl(value.includes('://') ? value : `https://${value}`);
  return (url?.hostname || value)
    .replace(/^www\./i, '')
    .replace(/\.$/, '')
    .toLowerCase();
}

export function getRegistrableHost(value) {
  const host = normalizeHost(value);
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }
  return parts.slice(-2).join('.');
}

export function entryCandidateValues(entry) {
  if (!entry) {
    return [];
  }
  return [
    entry.url,
    entry.website,
    entry.domain,
    entry.host,
    entry.name,
    entry.title,
  ].filter(Boolean);
}

export function normalizeEntryForDisplay(entry) {
  const displayUrl = entry.url || entry.website || entry.domain || '';
  return {
    ...entry,
    displayName: entry.name || entry.title || displayUrl || 'Untitled entry',
    displayUrl,
    displayHost: normalizeHost(displayUrl),
  };
}

export function entryMatchesUrl(entry, url) {
  const current = normalizeUrl(url);
  if (!current || !entry) {
    return false;
  }

  const currentHost = normalizeHost(current.hostname);
  const currentRoot = getRegistrableHost(currentHost);
  const candidates = entryCandidateValues(entry);

  return candidates.some((candidate) => {
    const candidateHost = normalizeHost(candidate);
    if (!candidateHost) {
      return false;
    }
    const candidateRoot = getRegistrableHost(candidateHost);
    return (
      currentHost === candidateHost ||
      currentHost.endsWith(`.${candidateHost}`) ||
      (currentRoot && candidateRoot && currentRoot === candidateRoot)
    );
  });
}

export function scoreEntriesForUrl(entries, url) {
  const current = normalizeUrl(url);
  const currentHost = normalizeHost(current?.hostname || '');
  const currentRoot = getRegistrableHost(currentHost);

  return (entries || [])
    .map((entry) => {
      const normalized = normalizeEntryForDisplay(entry);
      let score = entryMatchesUrl(normalized, url) ? 100 : 0;
      const candidateHosts = entryCandidateValues(normalized).map(normalizeHost).filter(Boolean);
      if (candidateHosts.includes(currentHost)) {
        score += 40;
      }
      if (candidateHosts.some((host) => getRegistrableHost(host) === currentRoot)) {
        score += 20;
      }
      return { entry: normalized, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry);
}
