// ===================== POPUP SCRIPT =====================
// AuraSafe Browser Extension - Popup UI Controller
// Version: 1.0.0

// ===================== DOM ELEMENTS =====================
const elements = {
  searchInput: document.getElementById('search'),
  entriesList: document.getElementById('list'),
  statusDiv: document.getElementById('status'),
  connectionStatus: document.getElementById('connectionStatus'),
  vaultStatus: document.getElementById('vaultStatus'),
  lockButton: document.getElementById('lockButton'),
  refreshButton: document.getElementById('refreshButton'),
  settingsButton: document.getElementById('settingsButton'),
  entryCount: document.getElementById('entryCount')
};

// ===================== STATE MANAGEMENT =====================
let currentEntries = [];
let currentFilter = '';
let connectionStatus = 'unknown';
let vaultUnlocked = false;
let refreshTimer = null;
let searchDebounceTimer = null;

// ===================== CONFIGURATION =====================
const CONFIG = {
  SEARCH_DEBOUNCE_MS: 300,
  AUTO_REFRESH_INTERVAL_MS: 30000,
  MAX_ENTRIES_DISPLAY: 50,
  STORAGE_KEYS: {
    LAST_MESSAGE: 'aurasafe_last_message',
    CONNECTION_STATUS: 'aurasafe_connection_status',
    VAULT_STATUS: 'aurasafe_vault_status',
    SETTINGS: 'aurasafe_settings'
  }
};

// ===================== UTILITY FUNCTIONS =====================

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Mask sensitive data for display
 */
function maskSensitive(value, type = 'password') {
  if (!value) return '';
  if (type === 'password') {
    return '•'.repeat(Math.min(value.length, 10));
  }
  if (type === 'username' && value.length > 8) {
    return value.substring(0, 3) + '•••' + value.substring(value.length - 2);
  }
  return value;
}

/**
 * Show status message with styling
 */
function showStatus(message, type = 'info') {
  if (!elements.statusDiv) return;
  
  const statusColors = {
    info: '#3b82f6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b'
  };
  
  elements.statusDiv.textContent = message;
  elements.statusDiv.style.color = statusColors[type] || statusColors.info;
  elements.statusDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  elements.statusDiv.style.padding = '8px';
  elements.statusDiv.style.borderRadius = '6px';
  elements.statusDiv.style.marginBottom = '10px';
  
  // Auto-clear info messages after 5 seconds
  if (type !== 'error') {
    setTimeout(() => {
      if (elements.statusDiv && elements.statusDiv.textContent === message) {
        elements.statusDiv.textContent = '';
      }
    }, 5000);
  }
}

/**
 * Update connection status UI
 */
function updateConnectionUI(status, details = {}) {
  connectionStatus = status;
  
  if (!elements.connectionStatus) return;
  
  const statusMap = {
    connected: { text: '✅ Connected', color: '#10b981' },
    connecting: { text: '🔄 Connecting...', color: '#f59e0b' },
    disconnected: { text: '❌ Disconnected', color: '#ef4444' },
    unpaired: { text: '🔗 Not paired', color: '#f59e0b' },
    error: { text: '⚠️ Connection error', color: '#ef4444' }
  };
  
  const info = statusMap[status] || statusMap.disconnected;
  elements.connectionStatus.textContent = info.text;
  elements.connectionStatus.style.color = info.color;
}

/**
 * Update vault status UI
 */
function updateVaultUI(unlocked) {
  vaultUnlocked = unlocked;
  
  if (!elements.vaultStatus) return;
  
  if (unlocked) {
    elements.vaultStatus.textContent = '🔓 Vault Unlocked';
    elements.vaultStatus.style.color = '#10b981';
    if (elements.lockButton) {
      elements.lockButton.textContent = '🔒 Lock Vault';
      elements.lockButton.disabled = false;
    }
  } else {
    elements.vaultStatus.textContent = '🔒 Vault Locked';
    elements.vaultStatus.style.color = '#f59e0b';
    if (elements.lockButton) {
      elements.lockButton.textContent = '🔓 Unlock Vault';
      elements.lockButton.disabled = false;
    }
  }
}

/**
 * Update entry count display
 */
function updateEntryCount(count) {
  if (elements.entryCount) {
    elements.entryCount.textContent = `${count} entries`;
  }
}

/**
 * Render entries list with search filtering
 */
function renderEntries() {
  if (!elements.entriesList) return;
  
  // Filter entries based on search
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
  
  // Limit display
  const displayEntries = filteredEntries.slice(0, CONFIG.MAX_ENTRIES_DISPLAY);
  updateEntryCount(filteredEntries.length);
  
  if (displayEntries.length === 0) {
    if (currentEntries.length === 0) {
      elements.entriesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔐</div>
          <div class="empty-title">No credentials yet</div>
          <div class="empty-text">Add your first credential in the AuraSafe desktop app</div>
        </div>
      `;
    } else {
      elements.entriesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No matching entries</div>
          <div class="empty-text">Try a different search term</div>
        </div>
      `;
    }
    return;
  }
  
  // Build entries HTML
  elements.entriesList.innerHTML = displayEntries.map(entry => `
    <div class="entry-item" data-id="${escapeHtml(entry.id)}">
      <div class="entry-header">
        <div class="entry-icon">🔑</div>
        <div class="entry-info">
          <div class="entry-title">${escapeHtml(entry.title || entry.name || 'Untitled')}</div>
          ${entry.url ? `<div class="entry-url">${escapeHtml(entry.url)}</div>` : ''}
        </div>
      </div>
      ${entry.username ? `
        <div class="entry-detail">
          <span class="detail-label">Username:</span>
          <span class="detail-value username-value">${escapeHtml(maskSensitive(entry.username, 'username'))}</span>
          <button class="copy-btn copy-username" data-username="${escapeHtml(entry.username)}" title="Copy username">📋</button>
        </div>
      ` : ''}
      ${entry.password ? `
        <div class="entry-detail">
          <span class="detail-label">Password:</span>
          <span class="detail-value password-value">${escapeHtml(maskSensitive(entry.password, 'password'))}</span>
          <button class="copy-btn copy-password" data-password="${escapeHtml(entry.password)}" title="Copy password">📋</button>
          <button class="reveal-btn" data-password="${escapeHtml(entry.password)}" title="Show/hide password">👁️</button>
        </div>
      ` : ''}
      <div class="entry-actions">
        <button class="action-btn fill-btn" data-entry='${JSON.stringify(entry).replace(/'/g, "\\'")}'>
          🔓 Fill
        </button>
        <button class="action-btn edit-btn" data-id="${escapeHtml(entry.id)}">
          ✏️ Edit
        </button>
      </div>
    </div>
  `).join('');
  
  // Attach event listeners to buttons
  attachButtonEventListeners();
}

/**
 * Attach event listeners to dynamically created buttons
 */
function attachButtonEventListeners() {
  // Fill buttons
  document.querySelectorAll('.fill-btn').forEach(btn => {
    btn.removeEventListener('click', handleFillClick);
    btn.addEventListener('click', handleFillClick);
  });
  
  // Copy username buttons
  document.querySelectorAll('.copy-username').forEach(btn => {
    btn.removeEventListener('click', handleCopyUsername);
    btn.addEventListener('click', handleCopyUsername);
  });
  
  // Copy password buttons
  document.querySelectorAll('.copy-password').forEach(btn => {
    btn.removeEventListener('click', handleCopyPassword);
    btn.addEventListener('click', handleCopyPassword);
  });
  
  // Reveal password buttons
  document.querySelectorAll('.reveal-btn').forEach(btn => {
    btn.removeEventListener('click', handleRevealPassword);
    btn.addEventListener('click', handleRevealPassword);
  });
  
  // Edit buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.removeEventListener('click', handleEditClick);
    btn.addEventListener('click', handleEditClick);
  });
}

/**
 * Handle fill button click
 */
async function handleFillClick(event) {
  const btn = event.currentTarget;
  const entryData = btn.getAttribute('data-entry');
  
  if (!entryData) return;
  
  try {
    const entry = JSON.parse(entryData);
    await fillCredentialsInActiveTab(entry);
    showStatus('✓ Credentials filled!', 'success');
    setTimeout(() => window.close(), 1000);
  } catch (error) {
    console.error('Fill error:', error);
    showStatus('Failed to fill credentials. Please refresh the page and try again.', 'error');
  }
}

/**
 * Handle copy username button click
 */
async function handleCopyUsername(event) {
  const btn = event.currentTarget;
  const username = btn.getAttribute('data-username');
  
  if (username) {
    await copyToClipboard(username, 'Username copied!');
  }
}

/**
 * Handle copy password button click
 */
async function handleCopyPassword(event) {
  const btn = event.currentTarget;
  const password = btn.getAttribute('data-password');
  
  if (password) {
    await copyToClipboard(password, 'Password copied!');
  }
}

/**
 * Handle reveal password button click
 */
function handleRevealPassword(event) {
  const btn = event.currentTarget;
  const password = btn.getAttribute('data-password');
  const detailDiv = btn.closest('.entry-detail');
  const valueSpan = detailDiv.querySelector('.password-value');
  
  if (valueSpan.textContent === '•'.repeat(Math.min(password.length, 10))) {
    valueSpan.textContent = password;
    btn.textContent = '🙈';
    btn.title = 'Hide password';
  } else {
    valueSpan.textContent = maskSensitive(password, 'password');
    btn.textContent = '👁️';
    btn.title = 'Show password';
  }
}

/**
 * Handle edit button click
 */
async function handleEditClick(event) {
  const btn = event.currentTarget;
  const id = btn.getAttribute('data-id');
  
  showStatus('Opening in desktop app...', 'info');
  
  // Send message to background to open desktop app
  await chrome.runtime.sendMessage({ 
    type: 'EDIT_ENTRY', 
    payload: { id } 
  });
}

/**
 * Fill credentials in the active tab
 */
async function fillCredentialsInActiveTab(entry) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.id) {
    throw new Error('No active tab found');
  }
  
  // Try content script first
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL',
      payload: entry
    });
  } catch (error) {
    // Content script not ready, inject it
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // Try again
    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL',
      payload: entry
    });
  }
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text, successMessage) {
  if (!text) {
    showStatus('Nothing to copy', 'warning');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    showStatus(`✓ ${successMessage}`, 'success');
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showStatus(`✓ ${successMessage}`, 'success');
  }
}

/**
 * Load entries from storage or background
 */
async function loadEntries() {
  // Show loading state
  if (elements.entriesList) {
    elements.entriesList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <div>Loading your vault...</div>
      </div>
    `;
  }
  
  try {
    // Try to get entries via direct message first
    const response = await chrome.runtime.sendMessage({ 
      type: 'GET_CREDENTIALS' 
    }).catch(() => null);
    
    if (response && response.entries) {
      currentEntries = response.entries;
      renderEntries();
      return;
    }
    
    // Fallback to storage
    const result = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.LAST_MESSAGE]);
    const lastMessage = result[CONFIG.STORAGE_KEYS.LAST_MESSAGE];
    
    if (lastMessage && lastMessage.type === 'entries' && lastMessage.entries) {
      currentEntries = lastMessage.entries;
      renderEntries();
    } else {
      // No entries found
      currentEntries = [];
      renderEntries();
    }
  } catch (error) {
    console.error('Load entries error:', error);
    showStatus('Failed to load entries. Make sure AuraSafe desktop is running.', 'error');
    currentEntries = [];
    renderEntries();
  }
}

/**
 * Refresh entries
 */
async function refreshEntries() {
  showStatus('Refreshing...', 'info');
  await loadEntries();
  showStatus('✓ Vault refreshed', 'success');
}

/**
 * Lock the vault
 */
async function lockVault() {
  try {
    await chrome.runtime.sendMessage({ type: 'LOCK_VAULT' });
    updateVaultUI(false);
    currentEntries = [];
    renderEntries();
    showStatus('Vault locked', 'success');
  } catch (error) {
    showStatus('Failed to lock vault', 'error');
  }
}

/**
 * Unlock the vault
 */
async function unlockVault() {
  showStatus('Please unlock using the desktop app', 'info');
  // This would typically open the desktop app or show a password prompt
  await chrome.runtime.sendMessage({ type: 'OPEN_DESKTOP_APP' });
}

/**
 * Open settings
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// ===================== EVENT LISTENERS =====================

// Search input with debounce
if (elements.searchInput) {
  elements.searchInput.addEventListener('input', (e) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentFilter = e.target.value;
      renderEntries();
    }, CONFIG.SEARCH_DEBOUNCE_MS);
  });
}

// Lock button
if (elements.lockButton) {
  elements.lockButton.addEventListener('click', () => {
    if (vaultUnlocked) {
      lockVault();
    } else {
      unlockVault();
    }
  });
}

// Refresh button
if (elements.refreshButton) {
  elements.refreshButton.addEventListener('click', refreshEntries);
}

// Settings button
if (elements.settingsButton) {
  elements.settingsButton.addEventListener('click', openSettings);
}

// ===================== MESSAGE HANDLING =====================

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CONNECTION_STATUS_CHANGED':
      updateConnectionUI(message.payload.status);
      break;
      
    case 'VAULT_STATUS_CHANGED':
      updateVaultUI(message.payload.unlocked);
      if (!message.payload.unlocked) {
        currentEntries = [];
        renderEntries();
      } else {
        loadEntries();
      }
      break;
      
    case 'CREDENTIALS_UPDATED':
      loadEntries();
      break;
      
    case 'ENTRIES_UPDATED':
      if (message.payload.entries) {
        currentEntries = message.payload.entries;
        renderEntries();
      }
      break;
  }
});

// ===================== STORAGE LISTENER =====================

/**
 * Listen for storage changes
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[CONFIG.STORAGE_KEYS.LAST_MESSAGE]) {
    const newValue = changes[CONFIG.STORAGE_KEYS.LAST_MESSAGE].newValue;
    if (newValue && newValue.type === 'entries' && newValue.entries) {
      currentEntries = newValue.entries;
      renderEntries();
    }
  }
});

// ===================== INITIALIZATION =====================

/**
 * Initialize popup
 */
async function init() {
  // Get connection status
  try {
    const status = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });
    updateConnectionUI(status?.status || 'unknown');
  } catch (e) {
    updateConnectionUI('disconnected');
  }
  
  // Get vault status
  try {
    const vaultStatus = await chrome.runtime.sendMessage({ type: 'GET_VAULT_STATUS' });
    updateVaultUI(vaultStatus?.unlocked || false);
  } catch (e) {
    updateVaultUI(false);
  }
  
  // Load entries
  await loadEntries();
  
  // Set up auto-refresh
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (vaultUnlocked) {
      loadEntries();
    }
  }, CONFIG.AUTO_REFRESH_INTERVAL_MS);
}

// Start the popup
init();

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (refreshTimer) clearInterval(refreshTimer);
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
});