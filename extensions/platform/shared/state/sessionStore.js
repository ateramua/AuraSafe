import { secureGet, secureSet } from '../storage/secureStore.js';

const SESSION_KEY = 'sessionStatus';

export const SessionMode = Object.freeze({
  desktop: 'desktop',
  cloud: 'cloud',
  offline: 'offline',
  disconnected: 'disconnected',
});

export async function getSessionStatus() {
  return (await secureGet(SESSION_KEY)) || {
    mode: SessionMode.disconnected,
    connected: false,
    updatedAt: Date.now(),
  };
}

export async function setSessionStatus(status) {
  const next = {
    ...status,
    updatedAt: Date.now(),
  };
  await secureSet(SESSION_KEY, next);
  return next;
}
