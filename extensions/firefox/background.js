// ===================== BACKGROUND SCRIPT =====================
// AuraSafe Browser Extension - HTTP Polling (Firefox Compatible)
// Version: 2.0.0 - Firefox WebExtension

const CONFIG = {
  DESKTOP_URL: 'http://localhost:3456',  // Fixed port
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
      // Save to browser.storage.local for popup to read (Firefox uses browser.storage)
      await browser.storage.local.set({ aurasafe_credentials: credentials });
      log('info', `Fetched ${credentials.length} credentials`);
      
      // Notify popup if open (Firefox uses browser.runtime)
      browser.runtime.sendMessage({ type: 'CREDENTIALS_UPDATED', payload: credentials }).catch(() => {});
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
      // Save to browser.storage.local for popup to read
      await browser.storage.local.set({ aurasafe_vault_status: status });
      log('info', `Vault status: ${status.unlocked ? 'Unlocked' : 'Locked'}`);
      
      // Notify popup if open
      browser.runtime.sendMessage({ type: 'VAULT_STATUS_CHANGED', payload: status }).catch(() => {});
      return status;
    }
  } catch (err) {
    // Silent fail
  }
  return null;
}

// ===================== DISCOVER DESKTOP PORT =====================
async function discoverDesktopPort() {
  // Try common ports
  const ports = [3456, 3000, 3001, 3002, 8080];
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
  log('warn', 'Desktop app not found - will retry on next poll');
  return false;
}

// ✅ NEW: Clean up stored tab data when tab is closed (Firefox)
browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.get(['lastOpenedTabId']).then((data) => {
    if (data.lastOpenedTabId === tabId) {
      browser.storage.local.remove(['lastOpenedTabId', 'lastEntry', 'lastOpenedUrl']);
      log('info', `Cleaned up stored data for closed tab: ${tabId}`);
    }
  }).catch(() => {});
});

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
// Firefox uses browser.runtime.onMessage
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async responses
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
    browser.storage.local.remove(['aurasafe_credentials']);
    browser.storage.local.set({ aurasafe_vault_status: { unlocked: false } });
    sendResponse({ success: true });
    return true;
  }
  
  // Return false for sync responses (no async work)
  return false;
});

// ===================== LIFECYCLE =====================
// Firefox uses browser.runtime.onInstalled
browser.runtime.onInstalled.addListener(() => {
  log('info', 'Extension installed - starting polling');
  startPolling();
});

// Firefox uses browser.runtime.onStartup
browser.runtime.onStartup.addListener(() => {
  log('info', 'Browser startup - starting polling');
  startPolling();
});

log('info', 'Background worker initialized (Firefox compatible)');