// ===================== BACKGROUND SERVICE WORKER =====================
// AuraSafe Browser Extension - HTTP Polling (LastPass Style)
// Version: 2.0.0

const CONFIG = {
  DESKTOP_URL: 'http://localhost:3456',  // ← Fixed port
  POLL_INTERVAL_MS: 3000,
};

let pollingInterval = null;

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
      // Save to chrome.storage.local for popup to read
      await chrome.storage.local.set({ aurasafe_credentials: credentials });
      log('info', `Fetched ${credentials.length} credentials`);
      
      // Notify popup if open
      chrome.runtime.sendMessage({ type: 'CREDENTIALS_UPDATED', payload: credentials }).catch(() => {});
      return credentials;
    }
  } catch (err) {
    // Desktop not running - silent fail
  }
  return [];
}

// ===================== FETCH STATUS FROM DESKTOP =====================
async function fetchStatus() {
  try {
    const response = await fetch(`${CONFIG.DESKTOP_URL}/api/status`);
    if (response.ok) {
      const status = await response.json();
      // Save to chrome.storage.local for popup to read
      await chrome.storage.local.set({ aurasafe_vault_status: status });
      log('info', `Vault status: ${status.unlocked ? 'Unlocked' : 'Locked'}`);
      
      // Notify popup if open
      chrome.runtime.sendMessage({ type: 'VAULT_STATUS_CHANGED', payload: status }).catch(() => {});
      return status;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
}


// Add this to background.js to discover the correct port
async function discoverDesktopPort() {
  // Try common ports
  const ports = [3000, 3001, 3002, 8080];
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/api/status`);
      if (response.ok) {
        CONFIG.DESKTOP_URL = `http://localhost:${port}`;
        log('info', `Desktop found on port ${port}`);
        return true;
      }
    } catch (e) {}
  }
  return false;
}
// ===================== START POLLING =====================
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  // Initial fetch
  fetchCredentials();
  fetchStatus();
  
  // Poll every 3 seconds
  pollingInterval = setInterval(() => {
    fetchCredentials();
    fetchStatus();
  }, CONFIG.POLL_INTERVAL_MS);
  
  log('info', `Started polling every ${CONFIG.POLL_INTERVAL_MS}ms`);
}

// ===================== HANDLE POPUP MESSAGES =====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    chrome.storage.local.remove(['aurasafe_credentials']);
    chrome.storage.local.set({ aurasafe_vault_status: { unlocked: false } });
    sendResponse({ success: true });
    return true;
  }
  
  // Return true for any message that might have an async response
  return true;
});

// ===================== LIFECYCLE =====================
chrome.runtime.onInstalled.addListener(() => {
  log('info', 'Extension installed - starting polling');
  startPolling();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'OPEN_SETTINGS') {
    // send signal to desktop app (via your existing bridge)
  }
});

chrome.runtime.onStartup.addListener(() => {
  log('info', 'Browser startup - starting polling');
  startPolling();
});

log('info', 'Background worker initialized');