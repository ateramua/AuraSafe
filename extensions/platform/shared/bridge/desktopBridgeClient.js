import { storageGet, storageRemove, storageSet } from '../browser/runtime.js';
import { createLogger } from '../logging/logger.js';
import {
  BRIDGE_COMMAND_TIMEOUT_MS,
  BRIDGE_PORT_END,
  BRIDGE_PORT_START,
  BRIDGE_SCAN_TIMEOUT_MS,
  DESKTOP_BRIDGE_PROTOCOL_VERSION,
  buildBridgeCommand,
} from './protocol.js';

const STORAGE_KEY = 'aurasafe.desktopBridge.session';
const logger = createLogger('desktop-bridge');

function bridgeUrl(port, path) {
  return `http://127.0.0.1:${port}${path}`;
}

async function timedFetch(url, options = {}, timeout = BRIDGE_SCAN_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getStoredSession() {
  const value = await storageGet(STORAGE_KEY);
  return value[STORAGE_KEY] || null;
}

async function saveSession(session) {
  await storageSet({ [STORAGE_KEY]: session });
}

export async function clearDesktopSession() {
  await storageRemove(STORAGE_KEY);
}

async function validateSession(session) {
  if (!session?.port || !session?.token || (session.expiresAt || 0) <= Date.now()) {
    return false;
  }

  try {
    const response = await timedFetch(
      bridgeUrl(session.port, '/bridge/health'),
      { headers: { Authorization: `Bearer ${session.token}` } },
      BRIDGE_COMMAND_TIMEOUT_MS,
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function scanPort(port) {
  try {
    const response = await timedFetch(bridgeUrl(port, '/bridge/info'));
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data?.app !== 'AuraSafe' || data?.supportsHandshake !== true) {
      return null;
    }
    if (Number(data.bridgeProtocol || 1) > DESKTOP_BRIDGE_PROTOCOL_VERSION) {
      logger.warn('Desktop bridge protocol is newer than extension supports', {
        desktopProtocol: data.bridgeProtocol,
        extensionProtocol: DESKTOP_BRIDGE_PROTOCOL_VERSION,
      });
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function discoverDesktopBridge() {
  const stored = await getStoredSession();
  if (await validateSession(stored)) {
    return stored;
  }

  await clearDesktopSession();

  for (let port = BRIDGE_PORT_START; port <= BRIDGE_PORT_END; port += 1) {
    const metadata = await scanPort(port);
    if (!metadata) {
      continue;
    }

    try {
      const response = await timedFetch(
        bridgeUrl(port, '/bridge/handshake'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: 'aurasafe-extension-platform', browser: 'chromium' }),
        },
        BRIDGE_COMMAND_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`Handshake failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.sessionToken) {
        throw new Error('Handshake response missing sessionToken');
      }

      const session = {
        port,
        token: data.sessionToken,
        expiresAt: data.expiresAt || Date.now() + 5 * 60 * 1000,
        version: data.version || null,
        bridgeProtocol: data.bridgeProtocol || metadata.bridgeProtocol || 1,
        capabilities: data.capabilities || metadata.capabilities || [],
        discoveredAt: Date.now(),
      };
      await saveSession(session);
      return session;
    } catch (error) {
      logger.warn('Handshake failed', { port, error: error.message });
    }
  }

  throw new Error('AuraSafe desktop bridge was not found');
}

export async function getDesktopStatus() {
  try {
    const session = await discoverDesktopBridge();
    return {
      connected: true,
      mode: 'desktop',
      version: session.version,
      bridgeProtocol: session.bridgeProtocol,
      capabilities: session.capabilities || [],
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    return {
      connected: false,
      mode: 'disconnected',
      error: error.message,
    };
  }
}

export async function callDesktop(action, payload = {}) {
  const session = await discoverDesktopBridge();
  const response = await timedFetch(
    bridgeUrl(session.port, '/bridge/command'),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(buildBridgeCommand(action, payload)),
    },
    BRIDGE_COMMAND_TIMEOUT_MS,
  );

  if (response.status === 401) {
    await clearDesktopSession();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Desktop bridge failed with HTTP ${response.status}`);
  }
  return data.result ?? data;
}

export async function getDesktopDiagnostics() {
  const session = await discoverDesktopBridge();
  const response = await timedFetch(
    bridgeUrl(session.port, '/bridge/diagnostics'),
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    },
    BRIDGE_COMMAND_TIMEOUT_MS,
  );

  if (response.status === 401) {
    await clearDesktopSession();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Desktop diagnostics failed with HTTP ${response.status}`);
  }
  return data;
}
