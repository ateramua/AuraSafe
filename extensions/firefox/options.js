// AuraSafe Extension Options Page Script (Firefox Compatible)
// Version: 2.0.0

// ===================== CROSS-BROWSER COMPATIBILITY =====================
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const storage = browserAPI.storage;
const runtime = browserAPI.runtime;
const tabs = browserAPI.tabs;

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

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ===================== UPDATE CONNECTION STATUS UI =====================
async function updateConnectionStatus() {
  const data = await storage.local.get(["aurasafe_connection_status"]);
  const status = data.aurasafe_connection_status?.status || "disconnected";

  const dot = document.getElementById("connectionDot");
  const text = document.getElementById("connectionText");

  if (!dot || !text) return;

  dot.className = "status-dot";

  if (status === "connected") {
    dot.classList.add("connected");
    text.textContent = "Connected";
  } else if (status === "connecting") {
    dot.classList.add("connecting");
    text.textContent = "Connecting...";
  } else {
    dot.classList.add("disconnected");
    text.textContent = "Disconnected";
  }
}

// ===================== LOAD CONNECTION STATUS =====================
async function loadConnectionStatus() {
  await updateConnectionStatus();
}

// ===================== LOAD SETTINGS =====================
async function loadSettings() {
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
    // Firefox uses runtime.id, Chrome uses runtime.id as well (both work)
    extensionIdSpan.textContent = runtime.id || 'Loading...';
  }
}

// ===================== SAVE SETTINGS =====================
async function saveSetting(key, value) {
  await storage.local.set({ [key]: value });
  showToast('Settings saved', 'success');
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
    runtime.sendMessage({ type: 'CONNECT' });
    setTimeout(() => updateConnectionStatus(), 2000);
  });
}

// Pair button - Firefox uses runtime.getURL (same as Chrome)
if (pairBtn) {
  pairBtn.addEventListener('click', () => {
    tabs.create({
      url: runtime.getURL('pairing.html')
    });
  });
}

// Clear cache
if (clearCacheBtn) {
  clearCacheBtn.addEventListener('click', async () => {
    await storage.local.remove([
      'aurasafe_credentials',
      'aurasafe_last_message',
      'aurasafe_pending_requests'
    ]);
    showToast('Local cache cleared', 'success');
  });
}

// Reset extension
if (resetExtensionBtn) {
  resetExtensionBtn.addEventListener('click', async () => {
    if (confirm('⚠️ WARNING: This will reset all settings. Continue?')) {
      await storage.local.clear();
      showToast('Extension reset. Reloading...', 'success');
      setTimeout(() => {
        // Firefox doesn't support runtime.reload() in all contexts
        // Use browser.runtime.reload() if available
        if (typeof runtime.reload === 'function') {
          runtime.reload();
        } else {
          showToast('Please reload the extension manually', 'info');
        }
      }, 1200);
    }
  });
}

// ===================== UPDATE UI HELPER =====================
function updateConnectionUI(status) {
  const dot = document.getElementById("connectionDot");
  const text = document.getElementById("connectionText");
  
  if (!dot || !text) return;
  
  dot.className = "status-dot";
  
  switch (status) {
    case 'connected':
      dot.classList.add('connected');
      text.textContent = 'Connected';
      break;
    case 'connecting':
      dot.classList.add('connecting');
      text.textContent = 'Connecting...';
      break;
    default:
      dot.classList.add('disconnected');
      text.textContent = 'Disconnected';
  }
}

function updateVaultUI(unlocked) {
  // This can be expanded if needed
  console.log(`Vault status: ${unlocked ? 'Unlocked' : 'Locked'}`);
}

async function loadEntries() {
  try {
    const result = await storage.local.get(['aurasafe_credentials']);
    const entries = result.aurasafe_credentials || [];
    console.log(`Loaded ${entries.length} credentials`);
    return entries;
  } catch (err) {
    console.error('Failed to load entries:', err);
    return [];
  }
}

// ===================== STORAGE SYNC =====================
storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    updateConnectionStatus();
  }
});

// ===================== MESSAGE SYNC =====================
runtime.onMessage.addListener((message) => {
  if (message.type === 'CONNECTION_STATUS') {
    updateConnectionUI(message.payload?.status || 'disconnected');
  }

  if (message.type === 'VAULT_STATUS_CHANGED') {
    updateVaultUI(message.payload?.unlocked || false);
    if (message.payload?.unlocked) loadEntries();
  }
});

// Request initial vault status
runtime.sendMessage({ type: 'GET_VAULT_STATUS' }).then((response) => {
  if (response) {
    updateVaultUI(response.unlocked);
    if (response.unlocked) loadEntries();
  }
}).catch(() => {
  // Silent fail - background may not be ready
});

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadConnectionStatus();
});