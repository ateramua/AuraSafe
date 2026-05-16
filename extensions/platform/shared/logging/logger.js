const REDACTED = '[redacted]';

function sanitize(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  const safe = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/password|secret|token|credential|private|key/i.test(key)) {
      safe[key] = REDACTED;
    } else {
      safe[key] = sanitize(nestedValue);
    }
  }
  return safe;
}

export function createLogger(scope) {
  const prefix = `[AuraSafe:${scope}]`;
  return {
    info(message, details) {
      console.info(prefix, message, details ? sanitize(details) : '');
    },
    warn(message, details) {
      console.warn(prefix, message, details ? sanitize(details) : '');
    },
    error(message, details) {
      console.error(prefix, message, details ? sanitize(details) : '');
    },
  };
}
