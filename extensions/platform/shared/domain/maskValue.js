/** Match desktop CategoryModal: first 2 + bullets + last 2. */
export function maskValue(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••••';
  return `${value.substring(0, 2)}••••${value.substring(value.length - 2)}`;
}

export function maskPassword() {
  return '••••••••';
}

export function entryLoginIdentifier(entry) {
  return entry?.username || entry?.email || entry?.login || '';
}

export function entryHostLabel(entry) {
  return entry?.displayHost || entry?.url || entry?.website || entry?.domain || '';
}
