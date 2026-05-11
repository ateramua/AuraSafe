// AuraSafe Chrome Extension Background Bridge
// Uses local HTTP bridge discovery and authenticated requests to the Electron app.

const STORAGE_KEY = 'aurasafeBridgeConfig';
const PORT_SCAN_START = 36000;
const PORT_SCAN_END = 36020;
const SCAN_TIMEOUT_MS = 1500;
const BRIDGE_TIMEOUT_MS = 5000;
const ALLOWED_EXTENSION_ORIGIN = /^(chrome-extension:\/\/|moz-extension:\/\/|edge-extension:\/\/)/i;
const DISCOVERY_FILE_URLS = [
  'file:///tmp/aurasafe-bridge.json',
  'file:///private/tmp/aurasafe-bridge.json',
  'file:///var/tmp/aurasafe-bridge.json',
];
const runtime = typeof browser !== 'undefined' ? browser : chrome;

function log(...args) {
  console.log('[AuraSafe Bridge]', ...args);
}

function logError(...args) {
  console.error('[AuraSafe Bridge]', ...args);
}

function getLastError() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
    return chrome.runtime.lastError;
  }
  if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.lastError) {
    return browser.runtime.lastError;
  }
  return null;
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    const result = chrome.storage.local.get(keys, (items) => {
      const err = getLastError();
      if (err) return reject(err);
      resolve(items);
    });
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    const result = chrome.storage.local.set(items, () => {
      const err = getLastError();
      if (err) return reject(err);
      resolve();
    });
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    }
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    const result = chrome.storage.local.remove(keys, () => {
      const err = getLastError();
      if (err) return reject(err);
      resolve();
    });
    if (result && typeof result.then === 'function') {
      result.then(resolve).catch(reject);
    }
  });
}

function abortableFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = options.timeout || SCAN_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal, cache: 'no-store' })
    .finally(() => clearTimeout(timer));
}

function buildBridgeUrl(port, path) {
  return `http://127.0.0.1:${port}${path}`;
}

async function getStoredBridgeConfig() {
  const raw = await storageGet(STORAGE_KEY);
  return raw[STORAGE_KEY] || null;
}

async function saveBridgeConfig(config) {
  await storageSet({ [STORAGE_KEY]: config });
}

async function clearBridgeConfig() {
  await storageRemove(STORAGE_KEY);
}

async function scanBridgePort(port) {
  try {
    const response = await abortableFetch(buildBridgeUrl(port, '/bridge/info'), {
      method: 'GET',
      timeout: SCAN_TIMEOUT_MS,
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data?.app === 'AuraSafe' && data?.supportsHandshake === true;
  } catch (err) {
    return false;
  }
}

async function discoverBridge() {
  const fileConfig = await discoverBridgeViaFile();
  if (fileConfig) {
    return fileConfig;
  }

  log('Attempting discovery across local bridge ports');
  for (let port = PORT_SCAN_START; port <= PORT_SCAN_END; port += 1) {
    const available = await scanBridgePort(port);
    if (!available) continue;

    log('Found AuraSafe bridge on port', port);

    try {
      const response = await abortableFetch(buildBridgeUrl(port, '/bridge/handshake'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: 'aurasafe-extension', browser: 'chrome' }),
        timeout: BRIDGE_TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error(`Handshake failed with status ${response.status}`);
      }

      const result = await response.json();
      if (!result.sessionToken) {
        throw new Error('Handshake response missing sessionToken');
      }

      const config = {
        port,
        token: result.sessionToken,
        expiresAt: result.expiresAt || Date.now() + 300000,
        discoveredAt: Date.now(),
      };

      await saveBridgeConfig(config);
      log('Saved bridge credentials', { port });
      return config;
    } catch (err) {
      logError('Handshake failed on port', port, err.message || err);
    }
  }

  throw new Error('Unable to discover local AuraSafe bridge');
}

let bridgeHeartbeatTimer = null;

async function validateBridgeConfig(config) {
  if (!config || !config.port || !config.token) return false;
  try {
    const response = await abortableFetch(buildBridgeUrl(config.port, '/bridge/health'), {
      method: 'GET',
      timeout: BRIDGE_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });
    return response.ok;
  } catch (_err) {
    return false;
  }
}

async function discoverBridgeViaFile() {
  for (const fileUrl of DISCOVERY_FILE_URLS) {
    try {
      const response = await abortableFetch(fileUrl, {
        method: 'GET',
        timeout: BRIDGE_TIMEOUT_MS,
      });
      if (!response.ok) continue;

      const fileData = await response.json();
      if (!fileData.port || !fileData.token) continue;

      const config = {
        port: fileData.port,
        token: fileData.token,
        expiresAt: Date.now() + 300000,
        discoveredAt: Date.now(),
      };

      if (await validateBridgeConfig(config)) {
        await saveBridgeConfig(config);
        log('Found bridge via discovery file', { fileUrl, port: config.port });
        return config;
      }
    } catch (err) {
      logError('File discovery check failed', fileUrl, err.message || err);
    }
  }
  return null;
}

function startBridgeHeartbeat() {
  if (bridgeHeartbeatTimer) {
    clearInterval(bridgeHeartbeatTimer);
  }
  bridgeHeartbeatTimer = setInterval(async () => {
    try {
      const healthy = await checkBridgeHealth();
      log('Bridge heartbeat', healthy ? 'ok' : 'unhealthy');
    } catch (err) {
      logError('Bridge heartbeat failed', err.message || err);
    }
  }, 15000);
}

function stopBridgeHeartbeat() {
  if (bridgeHeartbeatTimer) {
    clearInterval(bridgeHeartbeatTimer);
    bridgeHeartbeatTimer = null;
  }
}

async function ensureBridgeConfig() {
  const config = await getStoredBridgeConfig();
  if (config && (config.expiresAt || 0) > Date.now()) {
    const healthy = await validateBridgeConfig(config);
    if (healthy) return config;
  }

  await clearBridgeConfig();
  return await discoverBridge();
}

async function requestBridge(path, payload) {
  const config = await ensureBridgeConfig();
  const response = await abortableFetch(buildBridgeUrl(config.port, path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(payload),
    timeout: BRIDGE_TIMEOUT_MS,
  });

  if (response.status === 401) {
    await clearBridgeConfig();
    throw new Error('Unauthorized to local bridge');
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bridge responded with ${response.status}: ${body}`);
  }

  return response.json();
}

async function checkBridgeHealth() {
  const config = await ensureBridgeConfig();
  const response = await abortableFetch(buildBridgeUrl(config.port, '/bridge/health'), {
    method: 'GET',
    timeout: BRIDGE_TIMEOUT_MS,
  });
  return response.ok;
}

async function forwardToBridge(payload) {
  try {
    const response = await requestBridge('/bridge/command', payload);
    return response;
  } catch (err) {
    logError('Bridge request failed:', err.message || err);
    throw err;
  }
}

function normalizeHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isAutofillTargetTab(tabUrl, autofillUrl) {
  const tabHost = normalizeHost(tabUrl);
  const targetHost = normalizeHost(autofillUrl);
  if (!tabHost || !targetHost) return false;
  return tabHost === targetHost || tabHost.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${tabHost}`);
}

async function queryPendingAutofill() {
  try {
    return await forwardToBridge({ action: 'getPendingAutofill' });
  } catch (err) {
    return null;
  }
}

async function consumePendingAutofill() {
  try {
    return await forwardToBridge({ action: 'consumePendingAutofill' });
  } catch (err) {
    return null;
  }
}

async function tryAutofillTab(tabId, tabUrl) {
  if (!tabId || !tabUrl || !/^https?:\/\//i.test(tabUrl)) return;
  const pending = await queryPendingAutofill();
  if (!pending || !pending.entry) return;

  const targetUrl = pending.url || pending.entry.url || '';
  if (targetUrl && !isAutofillTargetTab(tabUrl, targetUrl)) return;

  chrome.tabs.sendMessage(tabId, { type: 'fill', entry: pending.entry }, async (response) => {
    const err = getLastError();
    if (err) {
      logError('Autofill sendMessage failed:', err.message || err);
      return;
    }
    if (response && response.success) {
      await consumePendingAutofill();
      log('Autofill delivered to tab', tabId);
    }
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    tryAutofillTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    tryAutofillTab(tabs[0].id, tabs[0].url);
  });
});

async function handleRuntimeMessage(request, sender, sendResponse) {
  try {
    if (request.type === 'bridge:proxy') {
      const result = await forwardToBridge(request.payload || {});
      sendResponse({ status: 'ok', result });
      return true;
    }

    if (request.action === 'ping' || request.type === 'ping') {
      const healthy = await checkBridgeHealth();
      sendResponse({ status: healthy ? 'connected' : 'disconnected' });
      return true;
    }

    if (request.action === 'getEntries') {
      const result = await forwardToBridge({ action: 'getVaultEntries' });
      sendResponse(result);
      return true;
    }

    if (request.action === 'forward' || request.type === 'forward') {
      const result = await forwardToBridge(request);
      sendResponse(result);
      return true;
    }

    const result = await forwardToBridge(request);
    sendResponse(result);
    return true;
  } catch (err) {
    sendResponse({ status: 'error', message: err.message || 'Bridge failure' });
    return true;
  }
}

chrome.runtime.onMessage.addListener(handleRuntimeMessage);

(async () => {
  try {
    const healthy = await checkBridgeHealth();
    log('Initial bridge health:', healthy ? 'ok' : 'unhealthy');
    if (healthy) startBridgeHeartbeat();
  } catch (err) {
    logError('Initial bridge startup check failed:', err.message || err);
  }
})();
