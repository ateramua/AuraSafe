// AuraSafe Extension Options Page Script (Firefox Compatible)
// Version: 2.1.0

// ===================== CROSS-BROWSER COMPATIBILITY =====================
// Firefox uses 'browser' namespace, Chrome uses 'chrome'
const browserAPI = (function() {
  if (typeof browser !== 'undefined' && browser.runtime) {
    return browser;
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  // Fallback for testing
  console.warn('No extension API found');
  return {
    storage: { local: { get: () => {}, set: () => {}, remove: () => {}, clear: () => {}, onChanged: { addListener: () => {} } } },
    runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} }, id: 'unknown', reload: () => {} },
    tabs: { create: () => {} }
  };
})();

const storage = browserAPI.storage;
const runtime = browserAPI.runtime;
const tabs = browserAPI.tabs;

// Helper for sending messages (works with both callback and Promise-based APIs)
async function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof runtime.sendMessage === 'function') {
        // Check if it returns a Promise (Firefox style)
        const result = runtime.sendMessage(message);
        if (result && typeof result.then === 'function') {
          result.then(resolve).catch(reject);
        } else {
          // Chrome style with callback
          runtime.sendMessage(message, (response) => {
            if (runtime.lastError) {
              reject(new Error(runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        }
      } else {
        resolve(null);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// ===================== DOM ELEMENTS =====================
const connectionDot = document.getElementById('connectionDot');
const connectionText = document.getElementById('connectionText');
const reconnectBtn = document.getElementById('reconnectBtn');
const pairBtn = document.getElementById('pairBtn');

const autoFillToggle = document.getElementById('autoFillToggle');
const notificationsToggle = document.getElementById('notificationsToggle');
const autoLockSelect = document.getElementById('autoLockSelect');
const passwordLengthSelect = document.getElementById('passwordLengthSelect');
const masterPasswordTimeoutSelect = document.getElementById('masterPasswordTimeoutSelect');

const clearCacheBtn = document.getElementById('clearCacheBtn');
const resetExtensionBtn = document.getElementById('resetExtensionBtn');
const extensionIdSpan = document.getElementById('extensionId');

// ===================== TOAST =====================
function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast && toast.remove) toast.remove();
  }, 3000);
}

// ===================== UPDATE CONNECTION STATUS UI =====================
async function updateConnectionStatus() {
  try {
    const data = await storage.local.get(["aurasafe_connection_status"]);
    const status = data.aurasafe_connection_status?.status || "disconnected";
    updateConnectionUI(status);
  } catch (error) {
    console.error('Failed to update connection status:', error);
    updateConnectionUI('disconnected');
  }
}

// ===================== LOAD CONNECTION STATUS =====================
async function loadConnectionStatus() {
  await updateConnectionStatus();
}

// ===================== LOAD SETTINGS =====================
async function loadSettings() {
  try {
    const result = await storage.local.get([
      'aurasafe_auto_fill',
      'aurasafe_notifications',
      'aurasafe_auto_lock',
      'aurasafe_password_length',
      'aurasafe_master_password_timeout'
    ]);

    if (autoFillToggle) autoFillToggle.checked = result.aurasafe_auto_fill === true;
    if (notificationsToggle) notificationsToggle.checked = result.aurasafe_notifications !== false;
    if (autoLockSelect) autoLockSelect.value = result.aurasafe_auto_lock || '0';
    if (passwordLengthSelect) passwordLengthSelect.value = result.aurasafe_password_length || '16';
    if (masterPasswordTimeoutSelect) masterPasswordTimeoutSelect.value = result.aurasafe_master_password_timeout || '0';

    if (extensionIdSpan) {
      // Firefox uses runtime.id, Chrome uses runtime.id as well
      extensionIdSpan.textContent = runtime.id || 'Not available';
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    showToast('Failed to load settings', 'error');
  }
}

// ===================== SAVE SETTINGS =====================
async function saveSetting(key, value) {
  try {
    await storage.local.set({ [key]: value });
    showToast('Settings saved', 'success');
  } catch (error) {
    console.error('Failed to save setting:', error);
    showToast('Failed to save setting', 'error');
  }
}

// ===================== EVENT LISTENERS =====================

// Auto-fill
if (autoFillToggle) {
  autoFillToggle.addEventListener('change', () => {
    saveSetting('aurasafe_auto_fill', autoFillToggle.checked);
  });
}

// Notifications
if (notificationsToggle) {
  notificationsToggle.addEventListener('change', () => {
    saveSetting('aurasafe_notifications', notificationsToggle.checked);
  });
}

// Auto lock
if (autoLockSelect) {
  autoLockSelect.addEventListener('change', () => {
    saveSetting('aurasafe_auto_lock', parseInt(autoLockSelect.value, 10));
  });
}

// Password length
if (passwordLengthSelect) {
  passwordLengthSelect.addEventListener('change', () => {
    saveSetting('aurasafe_password_length', parseInt(passwordLengthSelect.value, 10));
  });
}

// Master timeout
if (masterPasswordTimeoutSelect) {
  masterPasswordTimeoutSelect.addEventListener('change', () => {
    saveSetting('aurasafe_master_password_timeout', parseInt(masterPasswordTimeoutSelect.value, 10));
  });
}

// Reconnect
if (reconnectBtn) {
  reconnectBtn.addEventListener('click', async () => {
    showToast('Attempting to reconnect...', 'success');
    try {
      await sendRuntimeMessage({ type: 'CONNECT' });
      setTimeout(() => updateConnectionStatus(), 2000);
    } catch (error) {
      console.error('Reconnect failed:', error);
      showToast('Reconnect failed', 'error');
    }
  });
}

// Pair button
if (pairBtn) {
  pairBtn.addEventListener('click', () => {
    try {
      // Firefox and Chrome both support runtime.getURL
      const pairingUrl = runtime.getURL('pairing.html');
      tabs.create({ url: pairingUrl });
    } catch (error) {
      console.error('Failed to open pairing page:', error);
      showToast('Failed to open pairing page', 'error');
    }
  });
}

// Clear cache
if (clearCacheBtn) {
  clearCacheBtn.addEventListener('click', async () => {
    try {
      await storage.local.remove([
        'aurasafe_credentials',
        'aurasafe_last_message',
        'aurasafe_pending_requests'
      ]);
      showToast('Local cache cleared', 'success');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      showToast('Failed to clear cache', 'error');
    }
  });
}

// Reset extension
if (resetExtensionBtn) {
  resetExtensionBtn.addEventListener('click', async () => {
    const confirmed = confirm('⚠️ WARNING: This will reset all settings and clear all stored credentials. This action cannot be undone.\n\nContinue?');
    
    if (confirmed) {
      try {
        await storage.local.clear();
        showToast('Extension reset. Reloading...', 'success');
        
        setTimeout(() => {
          // Try to reload the extension
          if (typeof runtime.reload === 'function') {
            runtime.reload();
          } else {
            // Fallback for older Firefox versions
            showToast('Please reload the extension manually from about:debugging', 'info');
          }
        }, 1500);
      } catch (error) {
        console.error('Failed to reset extension:', error);
        showToast('Failed to reset extension', 'error');
      }
    }
  });
}

// ===================== UPDATE UI HELPER FUNCTIONS =====================
function updateConnectionUI(status) {
  const dot = document.getElementById("connectionDot");
  const text = document.getElementById("connectionText");
  
  if (!dot || !text) return;
  
  // Remove all status classes
  dot.classList.remove('connected', 'connecting', 'disconnected', 'unpaired');
  
  switch (status) {
    case 'connected':
      dot.classList.add('connected');
      text.textContent = 'Connected';
      break;
    case 'connecting':
      dot.classList.add('connecting');
      text.textContent = 'Connecting...';
      break;
    case 'unpaired':
      dot.classList.add('unpaired');
      text.textContent = 'Not Paired';
      break;
    default:
      dot.classList.add('disconnected');
      text.textContent = 'Disconnected';
  }
}

function updateVaultUI(unlocked) {
  const vaultStatusElement = document.getElementById('vaultStatus');
  if (vaultStatusElement) {
    vaultStatusElement.textContent = unlocked ? 'Unlocked 🔓' : 'Locked 🔒';
    vaultStatusElement.style.color = unlocked ? '#10b981' : '#f59e0b';
  }
  console.log(`Vault status: ${unlocked ? 'Unlocked' : 'Locked'}`);
}

async function loadEntries() {
  try {
    const result = await storage.local.get(['aurasafe_credentials']);
    const entries = result.aurasafe_credentials || [];
    const entryCountElement = document.getElementById('entryCount');
    if (entryCountElement) {
      entryCountElement.textContent = entries.length.toString();
    }
    console.log(`Loaded ${entries.length} credentials`);
    return entries;
  } catch (err) {
    console.error('Failed to load entries:', err);
    return [];
  }
}

// ===================== STORAGE SYNC =====================
if (storage && storage.onChanged) {
  storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      // Update connection status if changed
      if (changes.aurasafe_connection_status) {
        updateConnectionUI(changes.aurasafe_connection_status.newValue?.status || 'disconnected');
      }
      
      // Update vault status if changed
      if (changes.aurasafe_vault_status) {
        updateVaultUI(changes.aurasafe_vault_status.newValue?.unlocked || false);
        if (changes.aurasafe_vault_status.newValue?.unlocked) {
          loadEntries();
        }
      }
    }
  });
}

// ===================== MESSAGE SYNC =====================
if (runtime && runtime.onMessage) {
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle different message types
    if (message.type === 'CONNECTION_STATUS') {
      updateConnectionUI(message.payload?.status || 'disconnected');
      sendResponse({ received: true });
    }
    
    if (message.type === 'VAULT_STATUS_CHANGED') {
      updateVaultUI(message.payload?.unlocked || false);
      if (message.payload?.unlocked) loadEntries();
      sendResponse({ received: true });
    }
    
    if (message.type === 'CREDENTIALS_UPDATED') {
      loadEntries();
      sendResponse({ received: true });
    }
    
    // Return true for async response if needed
    return false;
  });
}

// Request initial vault status
async function requestInitialStatus() {
  try {
    const response = await sendRuntimeMessage({ type: 'GET_VAULT_STATUS' });
    if (response) {
      updateVaultUI(response.unlocked);
      if (response.unlocked) loadEntries();
    }
  } catch (error) {
    // Silent fail - background may not be ready yet
    console.debug('Background not ready yet');
  }
}

// ===================== ADD MISSING UI ELEMENTS (Optional) =====================
// Add vault status and entry count to the security card if they don't exist
function addOptionalUIElements() {
  const securityCard = document.querySelector('.card:nth-of-type(3) .button-group');
  if (securityCard && !document.getElementById('vaultStatus')) {
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 0.5rem;';
    statusDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>🔐 Vault Status:</span>
        <span id="vaultStatus" style="font-weight: bold;">Loading...</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
        <span>📦 Stored Entries:</span>
        <span id="entryCount" style="font-weight: bold;">0</span>
      </div>
    `;
    securityCard.parentNode.insertBefore(statusDiv, securityCard);
  }
}

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", async () => {
  console.log('Options page loaded - Firefox compatible mode');
  
  // Add optional UI elements
  addOptionalUIElements();
  
  // Load all settings
  await loadSettings();
  
  // Load connection status
  await loadConnectionStatus();
  
  // Request initial vault status
  await requestInitialStatus();
  
  // Load entries count
  await loadEntries();
  
  console.log('Options page initialized');
});