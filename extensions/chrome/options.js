// AuraSafe Extension Options Page Script

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
  const data = await chrome.storage.local.get(["aurasafe_connection_status"]);
  const status = data.aurasafe_connection_status?.status || "disconnected";

  const dot = document.getElementById("connectionDot");
  const text = document.getElementById("connectionText");

  if (!dot || !text) return;

  dot.className = "status-dot";

  if (status === "connected") {
    dot.classList.add("connected");
    text.textContent = "Connected";
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
  const result = await chrome.storage.local.get([
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
    extensionIdSpan.textContent = chrome.runtime.id;
  }
}

// ===================== SAVE SETTINGS =====================
async function saveSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
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
    saveSetting('aurasafe_auto_lock', parseInt(autoLockSelect.value));
  });
}

// Password length
if (passwordLengthSelect) {
  passwordLengthSelect.addEventListener('change', () => {
    saveSetting('aurasafe_password_length', parseInt(passwordLengthSelect.value));
  });
}

// Master timeout
if (masterPasswordTimeoutSelect) {
  masterPasswordTimeoutSelect.addEventListener('change', () => {
    saveSetting('aurasafe_master_password_timeout', parseInt(masterPasswordTimeoutSelect.value));
  });
}

// Reconnect
if (reconnectBtn) {
  reconnectBtn.addEventListener('click', async () => {
    showToast('Attempting to reconnect...', 'success');
    chrome.runtime.sendMessage({ type: 'CONNECT' });
    setTimeout(() => updateConnectionStatus(), 2000);
  });
}

// Pair button
if (pairBtn) {
  pairBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('pairing.html')
    });
  });
}

// Clear cache
if (clearCacheBtn) {
  clearCacheBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove([
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
      await chrome.storage.local.clear();
      showToast('Extension reset. Reloading...', 'success');
      setTimeout(() => {
        chrome.runtime.reload();
      }, 1200);
    }
  });
}

// ===================== STORAGE SYNC =====================
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    updateConnectionStatus();
  }
});

// ===================== MESSAGE SYNC =====================
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CONNECTION_STATUS') {
    updateConnectionUI(message.payload?.status || 'disconnected');
  }

  if (message.type === 'VAULT_STATUS_CHANGED') {
    updateVaultUI(message.payload?.unlocked || false);
    if (message.payload?.unlocked) loadEntries();
  }
});

chrome.runtime.sendMessage({ type: 'GET_VAULT_STATUS' }, (response) => {
  updateVaultUI(response.unlocked);
  if (response.unlocked) loadEntries();
});

// ===================== INIT =====================
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadConnectionStatus();
});