// ========================
// AuraSafe Vault Popup - Firefox Edition
// All original functionality preserved + modern UI/UX
// ========================

const searchInput = document.getElementById('search');
const list = document.getElementById('list');
const statusDiv = document.getElementById('status');
const loadingIndicator = document.getElementById('loadingIndicator') || createLoadingIndicator();

// Create loading indicator if not exists in HTML
function createLoadingIndicator() {
  const loader = document.createElement('div');
  loader.id = 'loadingIndicator';
  loader.className = 'loading-indicator';
  loader.innerHTML = `
    <div class="spinner"></div>
    <span>Loading vault entries...</span>
  `;
  loader.style.display = 'none';
  const container = document.querySelector('.entries-container');
  if (container) {
    container.insertBefore(loader, list);
  }
  return loader;
}

// Show/hide loading states
function setLoading(loading) {
  if (loadingIndicator) {
    loadingIndicator.style.display = loading ? 'flex' : 'none';
  }
  if (loading) {
    list.innerHTML = '';
  }
}

// Enhanced status message with styling
function updateStatus(message, type = 'error') {
  if (!statusDiv) return;
  
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  statusDiv.style.display = 'flex';
  
  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (statusDiv.style.display !== 'none') {
        statusDiv.style.opacity = '0';
        setTimeout(() => {
          statusDiv.style.display = 'none';
          statusDiv.style.opacity = '1';
        }, 300);
      }
    }, 3000);
  }
}

// Enhanced renderEntries with modern card design and animations
function renderEntries(entries) {
  list.innerHTML = '';
  const filter = searchInput.value.toLowerCase();
  
  if (!entries || entries.length === 0) {
    showEmptyState();
    return;
  }
  
  const filteredEntries = entries.filter(entry => 
    entry.name && entry.name.toLowerCase().includes(filter)
  );
  
  if (filteredEntries.length === 0) {
    showNoResults(filter);
    return;
  }
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  filteredEntries.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'vault-item';
    li.style.animationDelay = `${index * 0.03}s`;
    
    // Extract domain or site info for metadata
    const siteInfo = extractSiteInfo(entry);
    const usernameInfo = entry.username ? `@${truncate(entry.username, 20)}` : '';
    
    li.innerHTML = `
      <div class="item-content">
        <div class="item-icon">
          ${getSiteIcon(entry.name)}
        </div>
        <div class="item-details">
          <div class="entry-name">${escapeHtml(entry.name)}</div>
          <div class="entry-meta">
            ${usernameInfo ? `<span class="meta-username">${escapeHtml(usernameInfo)}</span>` : ''}
            ${siteInfo ? `<span class="meta-site">${escapeHtml(siteInfo)}</span>` : ''}
          </div>
        </div>
        <div class="item-action">
          <button class="fill-button" aria-label="Auto-fill credentials">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <span>Fill</span>
          </button>
        </div>
      </div>
    `;
    
    // Preserve original onclick functionality
    const fillButton = li.querySelector('.fill-button');
    const itemContent = li.querySelector('.item-content');
    
    const fillHandler = () => {
      // Visual feedback on click
      li.style.transform = 'scale(0.98)';
      setTimeout(() => { li.style.transform = ''; }, 150);
      
      // Original fill logic preserved exactly (using browser.tabs for Firefox)
      browser.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0] && tabs[0].id) {
          browser.tabs.sendMessage(tabs[0].id, { type: 'fill', entry }).then((response) => {
            if (response && response.success) {
              updateStatus(`✓ Filled ${entry.name} successfully!`, 'success');
            } else {
              updateStatus('Filled credentials (check page fields)', 'success');
            }
          }).catch((error) => {
            console.error('Fill error:', error);
            updateStatus('Unable to fill: Refresh the page and try again', 'error');
          });
        } else {
          updateStatus('No active tab found', 'error');
        }
      });
    };
    
    // Attach click handler to both button and item
    if (fillButton) fillButton.addEventListener('click', (e) => {
      e.stopPropagation();
      fillHandler();
    });
    
    li.addEventListener('click', fillHandler);
    fragment.appendChild(li);
  });
  
  list.appendChild(fragment);
}

// Helper: Extract site info from entry data
function extractSiteInfo(entry) {
  if (entry.url) return truncate(entry.url.replace(/^https?:\/\//, ''), 30);
  if (entry.site) return truncate(entry.site, 30);
  if (entry.domain) return truncate(entry.domain, 30);
  return '';
}

// Helper: Truncate long text
function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Helper: Get appropriate icon for site
function getSiteIcon(siteName) {
  const firstChar = siteName.charAt(0).toUpperCase();
  const colors = ['#1e4b6e', '#2b6a8f', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const colorIndex = siteName.length % colors.length;
  
  return `
    <div class="item-icon-circle" style="background: ${colors[colorIndex]}">
      ${firstChar}
    </div>
  `;
}

// Empty state with helpful message
function showEmptyState() {
  list.innerHTML = `
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.2">
        <rect x="3" y="5" width="18" height="16" rx="2" ry="2"></rect>
        <path d="M8 5V4h8v1" stroke="#94a3b8"></path>
        <line x1="12" y1="10" x2="12" y2="16"></line>
        <line x1="9" y1="13" x2="15" y2="13"></line>
      </svg>
      <p class="empty-title">No saved entries yet</p>
      <p class="empty-subtitle">Add credentials through the AuraSafe desktop app</p>
    </div>
  `;
}

// No results state for search
function showNoResults(searchTerm) {
  list.innerHTML = `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
        <circle cx="11" cy="11" r="8" stroke="currentColor"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor"/>
      </svg>
      <p class="empty-title">No results for "${escapeHtml(searchTerm)}"</p>
      <p class="empty-subtitle">Try a different search term</p>
    </div>
  `;
}

// Enhanced loadEntries with loading state and retry logic
async function loadEntries(retryCount = 0) {
  setLoading(true);
  
  try {
    const response = await browser.runtime.sendMessage({ action: 'getEntries' });
    
    if (response && response.status === 'disconnected') {
      updateStatus('⚠️ Not connected to AuraSafe desktop app. Check if it\'s running.', 'error');
      setLoading(false);
      showConnectionError();
      return;
    }
    
    // Wait for response via browser.storage (Firefox storage API)
    browser.storage.local.get(['lastMessage', 'lastUpdated']).then((result) => {
      setLoading(false);
      
      const msg = result.lastMessage;
      if (msg && msg.type === 'entries') {
        renderEntries(msg.entries);
        updateStatus(`✓ ${msg.entries.length} entries loaded`, 'success');
      } else if (msg && msg.type === 'error') {
        updateStatus(`Error: ${msg.message || 'Failed to load entries'}`, 'error');
        showConnectionError();
      } else {
        // No entries yet, but connection might be fine
        if (response && response.status !== 'disconnected') {
          updateStatus('No entries found. Add some in the desktop app.', 'info');
          showEmptyState();
        } else {
          updateStatus('Waiting for AuraSafe desktop connection...', 'info');
          showConnectionError();
        }
      }
    }).catch((error) => {
      setLoading(false);
      console.error('Storage error:', error);
      updateStatus('Error accessing storage', 'error');
    });
    
  } catch (error) {
    console.error('Load entries error:', error);
    setLoading(false);
    updateStatus('Connection error. Is AuraSafe desktop running?', 'error');
    showConnectionError();
    
    // Retry logic (max 3 retries)
    if (retryCount < 3) {
      setTimeout(() => loadEntries(retryCount + 1), 2000);
    }
  }
}

// Show connection error with retry button
function showConnectionError() {
  if (list.children.length === 0) {
    list.innerHTML = `
      <div class="empty-state error-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none"/>
        </svg>
        <p class="empty-title">Connection Lost</p>
        <p class="empty-subtitle">Make sure AuraSafe desktop app is running</p>
        <button id="retryConnection" class="retry-button">⟳ Retry Connection</button>
      </div>
    `;
    
    const retryBtn = document.getElementById('retryConnection');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        updateStatus('Reconnecting...', 'info');
        loadEntries();
      });
    }
  }
}

// Enhanced search with debouncing for better performance
let searchDebounceTimer;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    browser.storage.local.get(['lastMessage']).then((result) => {
      if (result.lastMessage && result.lastMessage.type === 'entries') {
        renderEntries(result.lastMessage.entries);
      }
    }).catch(() => {});
  }, 200);
});

// Listen for real-time updates from storage (Firefox compatible)
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.lastMessage) {
    const newMsg = changes.lastMessage.newValue;
    if (newMsg && newMsg.type === 'entries') {
      renderEntries(newMsg.entries);
      if (statusDiv.style.display !== 'none') {
        updateStatus('Vault updated', 'success');
      }
    }
  }
});

// Listen for connection status messages from background
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'connectionStatus') {
    if (message.connected) {
      updateStatus('Connected to AuraSafe!', 'success');
      loadEntries();
    }
  }
});

// Initial load
loadEntries();

// Optional: Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // CMD/Ctrl + F to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  // Escape to clear search
  if (e.key === 'Escape' && searchInput.value) {
    searchInput.value = '';
    loadEntries();
  }
});

// Add CSS styles dynamically (if not already in HTML)
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;
    color: #5b6e8c;
    font-size: 0.85rem;
  }
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e2e8f0;
    border-top-color: #1e4b6e;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .vault-item {
    animation: fadeSlideUp 0.25s ease backwards;
  }
  
  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .item-content {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  
  .item-icon-circle {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    color: white;
    flex-shrink: 0;
  }
  
  .item-details {
    flex: 1;
    min-width: 0;
  }
  
  .entry-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: #0f2c3f;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .entry-meta {
    font-size: 0.7rem;
    color: #6c86a3;
    margin-top: 2px;
    display: flex;
    gap: 8px;
  }
  
  .fill-button {
    background: #eef2ff;
    border: none;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #1e4b6e;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
    font-family: inherit;
  }
  
  .fill-button:hover {
    background: #1e4b6e;
    color: white;
    transform: scale(1.02);
  }
  
  .fill-button svg {
    transition: transform 0.2s ease;
  }
  
  .fill-button:hover svg {
    transform: translateX(2px);
  }
  
  .empty-state.error-state .empty-title {
    color: #dc2626;
  }
  
  .retry-button {
    margin-top: 16px;
    background: #1e4b6e;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 24px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .retry-button:hover {
    background: #0f2c3f;
    transform: translateY(-1px);
  }
  
  .status-message.info {
    background: #e6f4ea;
    border-left-color: #2c7a4b;
    color: #1e5a3a;
  }
  
  .meta-username, .meta-site {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  
  .meta-username::before {
    content: "👤";
    font-size: 0.65rem;
  }
  
  .meta-site::before {
    content: "🔗";
    font-size: 0.65rem;
  }
`;
document.head.appendChild(styleSheet);