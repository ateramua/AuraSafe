// ===================== BACKGROUND SERVICE WORKER =====================
// AuraSafe Browser Extension - HTTP Polling (LastPass Style)
// Firefox Compatible Version
// Version: 2.0.1

const CONFIG = {
  DESKTOP_URL: 'http://localhost:3456',  // ← Fixed port
  POLL_INTERVAL_MS: 3000,
};

let pollingInterval = null;

// ===================== FIREFOX COMPATIBILITY =====================
// Firefox uses 'browser' namespace primarily, but supports 'chrome' as alias
// We'll use 'chrome' for maximum compatibility, but add fallback
const storage = typeof chrome !== 'undefined' && chrome.storage 
  ? chrome.storage 
  : browser.storage;

const runtime = typeof chrome !== 'undefined' && chrome.runtime
  ? chrome.runtime
  : browser.runtime;

// ===================== LOGGING =====================
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const msg = `[AuraSafe][${timestamp}] ${level.toUpperCase()}: ${message}`;
  if (level === 'error') console.error(msg, data || '');
  else console.log(msg, data || '');
}

// ===================== FETCH CREDENTIALS FROM DESKTOP =====================
async function fetchCredentials() {
  try {
    const response = await fetch(`${CONFIG.DESKTOP_URL}/api/credentials`);
    if (response.ok) {
      const credentials = await response.json();
      // Save to storage for popup to read (Firefox compatible)
      await storage.local.set({ aurasafe_credentials: credentials });
      log('info', `Fetched ${credentials.length} credentials`);
      
      // Notify popup if open - Firefox handles this the same way
      runtime.sendMessage({ type: 'CREDENTIALS_UPDATED', payload: credentials }).catch(() => {});
      return credentials;
    }
  } catch (err) {
    // Desktop not running - silent fail
    log('debug', `Desktop connection failed: ${err.message}`);
  }
  return [];
}

// ===================== FETCH STATUS FROM DESKTOP =====================
async function fetchStatus() {
  try {
    const response = await fetch(`${CONFIG.DESKTOP_URL}/api/status`);
    if (response.ok) {
      const status = await response.json();
      // Save to storage for popup to read
      await storage.local.set({ aurasafe_vault_status: status });
      log('info', `Vault status: ${status.unlocked ? 'Unlocked' : 'Locked'}`);
      
      // Notify popup if open
      runtime.sendMessage({ type: 'VAULT_STATUS_CHANGED', payload: status }).catch(() => {});
      return status;
    }
  } catch (err) {
    // Silent fail
    log('debug', `Status fetch failed: ${err.message}`);
  }
  return null;
}

// ===================== DISCOVER DESKTOP PORT =====================
async function discoverDesktopPort() {
  // Try common ports
  const ports = [3456, 3000, 3001, 3002, 8080];
  for (const port of ports) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout per port
      
      const response = await fetch(`http://localhost:${port}/api/status`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        CONFIG.DESKTOP_URL = `http://localhost:${port}`;
        log('info', `Desktop found on port ${port}`);
        return true;
      }
    } catch (e) {
      // Continue to next port
    }
  }
  log('warn', 'Could not discover desktop app on any port');
  return false;
}

// ===================== START POLLING =====================
async function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  // Try to discover desktop on first run
  await discoverDesktopPort();
  
  // Initial fetch
  await fetchCredentials();
  await fetchStatus();
  
  // Poll every 3 seconds
  pollingInterval = setInterval(async () => {
    await fetchCredentials();
    await fetchStatus();
  }, CONFIG.POLL_INTERVAL_MS);
  
  log('info', `Started polling every ${CONFIG.POLL_INTERVAL_MS}ms`);
}

// ===================== HANDLE POPUP MESSAGES =====================
// Firefox uses the same onMessage API, but returns promises differently
runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CREDENTIALS_FROM_DESKTOP') {
    fetchCredentials().then(credentials => {
      sendResponse({ success: true, credentials });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'GET_VAULT_STATUS_FROM_DESKTOP') {
    fetchStatus().then(status => {
      sendResponse({ unlocked: status?.unlocked || false });
    }).catch(err => {
      sendResponse({ unlocked: false, error: err.message });
    });
    return true;
  }
  
  if (message.type === 'REFRESH_FROM_DESKTOP') {
    Promise.all([fetchCredentials(), fetchStatus()]).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'LOCK_VAULT') {
    storage.local.remove(['aurasafe_credentials']);
    storage.local.set({ aurasafe_vault_status: { unlocked: false } });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === 'OPEN_SETTINGS') {
    // send signal to desktop app (via your existing bridge)
    log('info', 'Open settings requested');
    sendResponse({ success: true });
    return true;
  }
  
  // Return true for any message that might have an async response
  return true;
});

// ===================== LIFECYCLE =====================
// Firefox uses onInstalled (same as Chrome)
runtime.onInstalled.addListener((details) => {
  log('info', `Extension ${details.reason} - starting polling`);
  startPolling();
});

// Firefox supports onStartup (same as Chrome)
runtime.onStartup.addListener(() => {
  log('info', 'Browser startup - starting polling');
  startPolling();
});

// Firefox also supports suspend events for background scripts
// Optional: Add cleanup on suspend
if (typeof runtime.onSuspend !== 'undefined') {
  runtime.onSuspend.addListener(() => {
    log('info', 'Background worker suspending - cleaning up');
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  });
}

log('info', 'Background worker initialized (Firefox compatible)');