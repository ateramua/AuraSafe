// ===================== POPUP SCRIPT =====================
// AuraSafe Browser Extension - Popup UI Controller (Firefox Compatible)
// Version: 2.0.0 - Firefox WebExtension

// ===================== CROSS-BROWSER COMPATIBILITY =====================
// Detect which browser API is available
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
const storage = browserAPI.storage;
const runtime = browserAPI.runtime;
const tabs = browserAPI.tabs;

// ===================== DOM ELEMENTS =====================
const elements = {
  searchInput: document.getElementById('searchInput'),
  entriesContainer: document.getElementById('entriesContainer'),
  connectionDot: document.getElementById('connectionDot'),
  connectionText: document.getElementById('connectionText'),
  lockIcon: document.getElementById('lockIcon'),
  vaultStatusText: document.getElementById('vaultStatusText'),
  lockBtn: document.getElementById('lockBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  settingsBtn: document.getElementById('settingsBtn')
};

// ===================== STATE =====================
let currentEntries = [];
let currentFilter = '';
let connectionStatus = 'unknown';
let vaultUnlocked = false;
let refreshTimer = null;
let searchDebounceTimer = null;

// ===================== CONFIG =====================
const CONFIG = {
  SEARCH_DEBOUNCE_MS: 300,
  AUTO_REFRESH_INTERVAL_MS: 30000,
  MAX_ENTRIES_DISPLAY: 50
};

// ===================== UTILS =====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function maskSensitive(value, type = 'password') {
  if (!value) return '';
  if (type === 'password') return '•'.repeat(Math.min(value.length, 10));
  if (type === 'username' && value.length > 8) {
    return value.substring(0, 3) + '•••' + value.substring(value.length - 2);
  }
  return value;
}

function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.className = `notification ${isError ? 'error' : ''}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// ===================== CONNECTION UI =====================
function updateConnectionUI(status) {
  connectionStatus = status;

  if (!elements.connectionDot || !elements.connectionText) return;

  elements.connectionDot.className = 'status-dot';

  switch (status) {
    case 'connected':
      elements.connectionDot.classList.add('connected');
      elements.connectionText.textContent = 'Connected';
      break;
    case 'connecting':
      elements.connectionDot.classList.add('connecting');
      elements.connectionText.textContent = 'Connecting...';
      break;
    case 'unpaired':
      elements.connectionDot.classList.add('disconnected');
      elements.connectionText.textContent = 'Not paired';
      break;
    default:
      elements.connectionDot.classList.add('disconnected');
      elements.connectionText.textContent = 'Disconnected';
  }
}

// ===================== VAULT UI =====================
function updateVaultUI(unlocked) {
  vaultUnlocked = unlocked;

  if (!elements.lockIcon || !elements.vaultStatusText) return;

  if (unlocked) {
    elements.lockIcon.textContent = '🔓';
    elements.vaultStatusText.textContent = 'Unlocked';
    if (elements.lockBtn) elements.lockBtn.textContent = '🔒 Lock Vault';
  } else {
    elements.lockIcon.textContent = '🔒';
    elements.vaultStatusText.textContent = 'Locked';
    if (elements.lockBtn) elements.lockBtn.textContent = '🔓 Unlock Vault';
  }
}

// ===================== REQUEST CREDENTIALS VIA BACKGROUND =====================
async function requestCredentialsFromDesktop() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for credentials'));
    }, 5000);
    
    // Send message to background script to request credentials (Firefox uses callbacks or promises)
    runtime.sendMessage({ type: 'GET_CREDENTIALS_FROM_DESKTOP' }).then(response => {
      clearTimeout(timeout);
      if (response && response.success) {
        resolve(response.credentials);
      } else {
        reject(new Error(response?.error || 'Failed to get credentials'));
      }
    }).catch(err => {
      clearTimeout(timeout);
      reject(new Error(err.message));
    });
  });
}

// ===================== CHECK CURRENT VAULT STATUS =====================
async function checkCurrentVaultStatus() {
  try {
    // First check if we have stored vault status
    const result = await storage.local.get(['aurasafe_vault_status', 'aurasafe_credentials']);
    
    if (result.aurasafe_vault_status) {
      const isUnlocked = result.aurasafe_vault_status.unlocked === true;
      updateVaultUI(isUnlocked);
      
      if (isUnlocked && result.aurasafe_credentials) {
        currentEntries = result.aurasafe_credentials;
        renderEntries();
      }
      console.log(`[Popup] Vault status from storage: ${isUnlocked ? 'Unlocked' : 'Locked'}`);
      return isUnlocked;
    }
    return false;
  } catch (err) {
    console.error('[Popup] Failed to check status:', err);
    return false;
  }
}

// ===================== REQUEST FRESH STATUS FROM DESKTOP =====================
async function requestFreshStatus() {
  try {
    const response = await runtime.sendMessage({ type: 'GET_VAULT_STATUS_FROM_DESKTOP' });
    if (response && response.unlocked !== undefined) {
      updateVaultUI(response.unlocked);
      if (response.unlocked && response.credentials) {
        currentEntries = response.credentials;
        renderEntries();
      }
      return response.unlocked;
    }
  } catch (err) {
    console.log('Could not get fresh status:', err);
  }
  return false;
}

// ===================== FILL CREDENTIALS IN ACTIVE TAB =====================
async function fillCredentials(entry) {
  try {
    const [tab] = await tabs.query({ active: true, currentWindow: true });
    await tabs.sendMessage(tab.id, { type: 'FILL', payload: entry });
    showNotification('✓ Credentials filled!');
    setTimeout(() => window.close(), 500);
  } catch (err) {
    showNotification('Failed to fill credentials', true);
  }
}

// ===================== RENDER ENTRIES =====================
function renderEntries() {
  if (!elements.entriesContainer) return;

  let filteredEntries = currentEntries;

  if (currentFilter) {
    const searchTerm = currentFilter.toLowerCase();
    filteredEntries = currentEntries.filter(entry =>
      (entry.title && entry.title.toLowerCase().includes(searchTerm)) ||
      (entry.name && entry.name.toLowerCase().includes(searchTerm)) ||
      (entry.username && entry.username.toLowerCase().includes(searchTerm)) ||
      (entry.url && entry.url.toLowerCase().includes(searchTerm))
    );
  }

  if (filteredEntries.length === 0) {
    if (currentEntries.length === 0) {
      elements.entriesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔐</div>
          <div class="empty-text">No credentials yet</div>
          <div class="empty-hint">Add credentials in the desktop app</div>
        </div>`;
    } else {
      elements.entriesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">No matching entries</div>
          <div class="empty-hint">Try a different search term</div>
        </div>`;
    }
    return;
  }

  elements.entriesContainer.innerHTML = filteredEntries.map(entry => `
    <div class="entry-item" data-id="${escapeHtml(entry.id)}">
      <div class="entry-title">
        <span>🔑</span>
        <span>${escapeHtml(entry.title || entry.name || 'Untitled')}</span>
      </div>
      ${entry.url ? `<div class="entry-url">${escapeHtml(entry.url)}</div>` : ''}
      ${entry.username ? `<div class="entry-username">👤 ${escapeHtml(maskSensitive(entry.username, 'username'))}</div>` : ''}
      <div class="entry-actions">
        <button class="action-btn fill-btn" data-entry='${JSON.stringify(entry).replace(/'/g, "\\'")}'>🔓 Fill</button>
        ${entry.username ? `<button class="action-btn copy-user" data-username="${escapeHtml(entry.username)}">📋 Copy User</button>` : ''}
        ${entry.password ? `<button class="action-btn copy-pass" data-password="${escapeHtml(entry.password)}">📋 Copy Pass</button>` : ''}
      </div>
    </div>
  `).join('');

  attachButtonEventListeners(filteredEntries);
}

function attachButtonEventListeners(entries) {
  document.querySelectorAll('.fill-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const entryData = btn.getAttribute('data-entry');
      if (entryData) {
        try {
          const entry = JSON.parse(entryData);
          await fillCredentials(entry);
        } catch (err) {
          showNotification('Failed to fill credentials', true);
        }
      }
    };
  });

  document.querySelectorAll('.copy-user').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const username = btn.getAttribute('data-username');
      if (username) {
        await navigator.clipboard.writeText(username);
        showNotification('Username copied!');
      }
    };
  });

  document.querySelectorAll('.copy-pass').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const password = btn.getAttribute('data-password');
      if (password) {
        await navigator.clipboard.writeText(password);
        showNotification('Password copied!');
      }
    };
  });
}

// ===================== LOAD ENTRIES =====================
async function loadEntries() {
  if (!elements.entriesContainer) return;

  elements.entriesContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div>Loading vault entries...</div>
    </div>`;

  try {
    const result = await storage.local.get(['aurasafe_credentials']);
    currentEntries = result.aurasafe_credentials || [];
    renderEntries();
  } catch (err) {
    console.error('Failed to load entries', err);
    elements.entriesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Failed to load credentials</div>
        <div class="empty-hint">Make sure AuraSafe desktop is running</div>
      </div>`;
  }
}

// ===================== EVENTS =====================
if (elements.lockBtn) {
  elements.lockBtn.addEventListener('click', async () => {
    if (vaultUnlocked) {
      // Lock the vault
      runtime.sendMessage({ type: 'LOCK_VAULT' });
      updateVaultUI(false);
      currentEntries = [];
      renderEntries();
      showNotification('Vault locked');
    } else {
      // Unlock - request credentials from desktop
      showNotification('Requesting credentials from desktop...');
      
      try {
        const credentials = await requestCredentialsFromDesktop();
        
        if (credentials && credentials.length > 0) {
          await storage.local.set({ aurasafe_credentials: credentials });
          updateVaultUI(true);
          currentEntries = credentials;
          renderEntries();
          showNotification(`✅ Vault unlocked with ${credentials.length} credentials`);
        } else {
          showNotification('No credentials found in vault', true);
        }
      } catch (error) {
        console.error('Unlock error:', error);
        showNotification(`Failed to unlock: ${error.message}`, true);
      }
    }
  });
}

if (elements.refreshBtn) {
  elements.refreshBtn.addEventListener('click', loadEntries);
}

if (elements.settingsBtn) {
  elements.settingsBtn.addEventListener('click', () => {
    runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  });
}

if (elements.searchInput) {
  elements.searchInput.addEventListener('input', (e) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentFilter = e.target.value;
      renderEntries();
    }, CONFIG.SEARCH_DEBOUNCE_MS);
  });
}

// ===================== STORAGE SYNC =====================
storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.aurasafe_credentials) {
    currentEntries = changes.aurasafe_credentials.newValue || [];
    renderEntries();
  }
  
  // Listen for connection status changes
  if (area === 'local' && changes.aurasafe_connection_status) {
    const status = changes.aurasafe_connection_status.newValue?.status || 'disconnected';
    updateConnectionUI(status);
  }
  
  // Listen for vault status changes
  if (area === 'local' && changes.aurasafe_vault_status) {
    const isUnlocked = changes.aurasafe_vault_status.newValue?.unlocked || false;
    updateVaultUI(isUnlocked);
    if (isUnlocked) {
      loadEntries();
    } else {
      currentEntries = [];
      renderEntries();
    }
  }
});

// ===================== MESSAGE HANDLING =====================
runtime.onMessage.addListener((message) => {
  if (message.type === 'CONNECTION_STATUS') {
    updateConnectionUI(message.payload?.status || 'disconnected');
  }

  // Listen for vault status changes from background
  if (message.type === 'VAULT_STATUS_CHANGED') {
    console.log('[Popup] Status update received:', message.payload);
    updateVaultUI(message.payload?.unlocked || false);
    if (message.payload?.unlocked) {
      loadEntries();
    } else {
      currentEntries = [];
      renderEntries();
    }
  }
  
  // Handle credentials pushed from background
  if (message.type === 'CREDENTIALS_UPDATED') {
    if (message.payload && message.payload.length > 0) {
      updateVaultUI(true);
      currentEntries = message.payload;
      renderEntries();
    }
  }
});

// ===================== INIT =====================
async function init() {
  try {
    // Get connection status (always show as checking initially)
    updateConnectionUI('connecting');
    
    // Try to load credentials from storage first
    const storageResult = await storage.local.get(['aurasafe_credentials', 'aurasafe_vault_status']);
    
    if (storageResult.aurasafe_credentials && storageResult.aurasafe_credentials.length > 0) {
      // We have credentials, vault is unlocked
      updateVaultUI(true);
      currentEntries = storageResult.aurasafe_credentials;
      renderEntries();
      updateConnectionUI('connected');
      console.log(`✅ Loaded ${currentEntries.length} credentials from storage`);
    } else {
      // No credentials, try to fetch fresh from desktop
      updateVaultUI(false);
      updateConnectionUI('connected');
      
      // Request fresh data from background
      try {
        const response = await runtime.sendMessage({ type: 'REFRESH_FROM_DESKTOP' });
        if (response && response.success) {
          const newResult = await storage.local.get(['aurasafe_credentials']);
          if (newResult.aurasafe_credentials && newResult.aurasafe_credentials.length > 0) {
            updateVaultUI(true);
            currentEntries = newResult.aurasafe_credentials;
            renderEntries();
            showNotification(`✅ Loaded ${currentEntries.length} credentials`);
          } else {
            await loadEntries(); // Show empty state
          }
        } else {
          await loadEntries(); // Show empty state
        }
      } catch (err) {
        console.log('Refresh failed:', err);
        await loadEntries(); // Show empty state
      }
    }
  } catch (e) {
    console.error('Init error:', e);
    updateConnectionUI('disconnected');
    updateVaultUI(false);
  }
}

// Initialize the popup
init();

// Refresh connection status periodically
setInterval(async () => {
  const result = await storage.local.get(['aurasafe_connection_status']);
  const status = result.aurasafe_connection_status?.status || 'disconnected';
  updateConnectionUI(status);
}, 5000);

// Auto-refresh entries only if vault is unlocked
setInterval(() => {
  if (vaultUnlocked) loadEntries();
}, CONFIG.AUTO_REFRESH_INTERVAL_MS);