// ===================== BACKGROUND SERVICE WORKER =====================
// AuraSafe Browser Extension - Desktop Bridge
// Version: 1.0.0

// ===================== CONFIGURATION =====================
const CONFIG = {
  // WebSocket connection settings
  WS_HOST: 'localhost',
  WS_PORT: 8765,
  WS_PATH: '/',
  WS_RECONNECT_DELAY: 5000,
  WS_MAX_RECONNECT_ATTEMPTS: 10,
  
  // Message timeouts
  MESSAGE_TIMEOUT: 30000,
  
  // Connection health check
  HEALTH_CHECK_INTERVAL: 30000,
  
  // Storage keys
  STORAGE_KEYS: {
    CONNECTION_STATUS: 'aurasafe_connection_status',
    LAST_MESSAGE: 'aurasafe_last_message',
    VAULT_STATUS: 'aurasafe_vault_status',
    PENDING_REQUESTS: 'aurasafe_pending_requests'
  }
};

// ===================== STATE MANAGEMENT =====================
let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let healthCheckInterval = null;
let pendingRequests = new Map();
let isConnecting = false;
let connectionStatus = 'disconnected';

// Message handlers registry
const messageHandlers = new Map();

// ===================== UTILITY FUNCTIONS =====================

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Update connection status in storage and notify popup
 */
async function updateConnectionStatus(status, details = {}) {
  connectionStatus = status;
  await chrome.storage.local.set({
    [CONFIG.STORAGE_KEYS.CONNECTION_STATUS]: {
      status,
      timestamp: Date.now(),
      ...details
    }
  });
  
  // Notify all extension pages
  chrome.runtime.sendMessage({
    type: 'CONNECTION_STATUS_CHANGED',
    payload: { status, ...details }
  }).catch(() => {
    // No listeners yet, ignore
  });
}

/**
 * Log with timestamp and level
 */
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  // Console output
  const consoleMsg = `[AuraSafe][${timestamp}] ${level.toUpperCase()}: ${message}`;
  if (level === 'error') {
    console.error(consoleMsg, data || '');
  } else if (level === 'warn') {
    console.warn(consoleMsg, data || '');
  } else {
    console.log(consoleMsg, data || '');
  }
  
  // Store last 100 logs for debugging
  chrome.storage.local.get(['logs'], (result) => {
    let logs = result.logs || [];
    logs.push(logEntry);
    if (logs.length > 100) logs = logs.slice(-100);
    chrome.storage.local.set({ logs });
  });
}

// ===================== WEBSOCKET CONNECTION =====================

/**
 * Establish WebSocket connection to desktop app
 */
async function connect() {
  if (isConnecting) {
    log('debug', 'Connection already in progress, skipping');
    return;
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    log('debug', 'Already connected, skipping');
    return;
  }
  
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    log('debug', 'Connection already in progress, skipping');
    return;
  }
  
  isConnecting = true;
  
  // Clean up existing connection
  cleanupWebSocket();
  
  // Get the secret from storage (set during pairing)
  const storage = await chrome.storage.local.get(['aurasafe_secret', 'aurasafe_token']);
  const secret = storage.aurasafe_secret;
  const token = storage.aurasafe_token;
  
  if (!secret) {
    log('warn', 'No pairing secret found. Please pair the extension with AuraSafe desktop.');
    updateConnectionStatus('unpaired');
    isConnecting = false;
    return;
  }
  
  const wsUrl = `ws://${CONFIG.WS_HOST}:${CONFIG.WS_PORT}${CONFIG.WS_PATH}?token=${encodeURIComponent(secret)}`;
  
  try {
    log('info', `Connecting to AuraSafe desktop at ${CONFIG.WS_HOST}:${CONFIG.WS_PORT}...`);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = handleConnectionOpen;
    ws.onclose = handleConnectionClose;
    ws.onerror = handleConnectionError;
    ws.onmessage = handleMessage;
    
  } catch (error) {
    log('error', 'Failed to create WebSocket connection', error);
    scheduleReconnect();
    isConnecting = false;
  }
}

/**
 * Handle successful connection
 */
function handleConnectionOpen() {
  log('info', '✅ Connected to AuraSafe desktop app');
  reconnectAttempts = 0;
  isConnecting = false;
  updateConnectionStatus('connected');
  
  // Send handshake message
  sendMessage({
    type: 'HANDSHAKE',
    payload: {
      client: 'browser-extension',
      version: '1.0.0',
      timestamp: Date.now()
    }
  });
  
  // Start health check
  startHealthCheck();
}

/**
 * Handle connection close
 */
function handleConnectionClose(event) {
  log('warn', `Connection closed: ${event.code} - ${event.reason || 'No reason'}`);
  cleanupWebSocket();
  updateConnectionStatus('disconnected', { code: event.code, reason: event.reason });
  scheduleReconnect();
  isConnecting = false;
}

/**
 * Handle connection error
 */
function handleConnectionError(error) {
  log('error', 'WebSocket connection error', error);
  updateConnectionStatus('error', { message: error.message });
  isConnecting = false;
}

/**
 * Clean up WebSocket and related timers
 */
function cleanupWebSocket() {
  if (ws) {
    try {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch (e) {
      log('debug', 'Error closing WebSocket', e);
    }
    ws = null;
  }
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  
  if (reconnectAttempts >= CONFIG.WS_MAX_RECONNECT_ATTEMPTS) {
    log('error', `Max reconnection attempts (${CONFIG.WS_MAX_RECONNECT_ATTEMPTS}) reached. Stopping.`);
    updateConnectionStatus('failed', { message: 'Max reconnection attempts reached' });
    return;
  }
  
  const delay = Math.min(
    CONFIG.WS_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
    60000
  );
  
  log('info', `Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts + 1}/${CONFIG.WS_MAX_RECONNECT_ATTEMPTS})`);
  
  reconnectTimer = setTimeout(() => {
    reconnectAttempts++;
    connect();
  }, delay);
}

/**
 * Start health check interval
 */
function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'PING',
        payload: { timestamp: Date.now() }
      }).catch(() => {
        // Silent fail - will be caught by connection close
      });
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL);
}

// ===================== MESSAGE HANDLING =====================

/**
 * Send message to desktop app and wait for response
 */
async function sendMessage(message, timeout = CONFIG.MESSAGE_TIMEOUT) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to AuraSafe desktop');
  }
  
  const requestId = message.id || generateRequestId();
  const messageWithId = { ...message, id: requestId };
  
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Request timeout: ${message.type}`));
    }, timeout);
    
    pendingRequests.set(requestId, { resolve, reject, timeoutId });
    
    try {
      ws.send(JSON.stringify(messageWithId));
    } catch (error) {
      clearTimeout(timeoutId);
      pendingRequests.delete(requestId);
      reject(error);
    }
  });
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    log('debug', 'Received message from desktop', { type: data.type });
    
    // Handle response to pending request
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject, timeoutId } = pendingRequests.get(data.id);
      clearTimeout(timeoutId);
      pendingRequests.delete(data.id);
      
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
      return;
    }
    
    // Handle server-initiated messages
    switch (data.type) {
      case 'PONG':
        log('debug', 'Health check response received');
        break;
        
      case 'VAULT_STATUS_CHANGED':
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.VAULT_STATUS]: data.payload
        });
        chrome.runtime.sendMessage({
          type: 'VAULT_STATUS_CHANGED',
          payload: data.payload
        }).catch(() => {});
        break;
        
      case 'CREDENTIALS_UPDATED':
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.LAST_MESSAGE]: data.payload
        });
        chrome.runtime.sendMessage({
          type: 'CREDENTIALS_UPDATED',
          payload: data.payload
        }).catch(() => {});
        break;
        
      default:
        // Forward to popup
        chrome.runtime.sendMessage(data).catch(() => {});
        await chrome.storage.local.set({
          [CONFIG.STORAGE_KEYS.LAST_MESSAGE]: data
        });
    }
    
    // Call registered handlers
    if (messageHandlers.has(data.type)) {
      const handlers = messageHandlers.get(data.type);
      handlers.forEach(handler => {
        try {
          handler(data.payload, data);
        } catch (error) {
          log('error', `Error in message handler for ${data.type}`, error);
        }
      });
    }
    
  } catch (error) {
    log('error', 'Failed to parse incoming message', error);
  }
}

/**
 * Register a message handler
 */
function onMessage(type, handler) {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, []);
  }
  messageHandlers.get(type).push(handler);
}

/**
 * Remove a message handler
 */
function offMessage(type, handler) {
  if (messageHandlers.has(type)) {
    const handlers = messageHandlers.get(type);
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }
}

// ===================== EXTENSION MESSAGE HANDLING =====================

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  log('debug', `Received message from ${sender.id || 'extension'}`, { type: request.type });
  
  const handleAsync = async () => {
    try {
      switch (request.type) {
        case 'GET_CONNECTION_STATUS':
          sendResponse({ status: connectionStatus });
          break;
          
        case 'GET_VAULT_STATUS':
          const storage = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.VAULT_STATUS]);
          sendResponse(storage[CONFIG.STORAGE_KEYS.VAULT_STATUS] || { unlocked: false });
          break;
          
        case 'GET_CREDENTIALS':
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage({
              type: 'GET_CREDENTIALS',
              payload: request.payload || {}
            });
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
          break;
          
        case 'SAVE_CREDENTIALS':
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage({
              type: 'SAVE_CREDENTIALS',
              payload: request.payload
            });
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
          break;
          
        case 'GENERATE_PASSWORD':
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage({
              type: 'GENERATE_PASSWORD',
              payload: request.payload || { length: 16 }
            });
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
          break;
          
        case 'UNLOCK_VAULT':
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage({
              type: 'UNLOCK_VAULT',
              payload: request.payload
            });
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
          break;
          
        case 'LOCK_VAULT':
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage({
              type: 'LOCK_VAULT',
              payload: request.payload || {}
            });
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
          break;
          
        case 'CONNECT':
          connect();
          sendResponse({ success: true });
          break;
          
        case 'DISCONNECT':
          cleanupWebSocket();
          updateConnectionStatus('disconnected');
          sendResponse({ success: true });
          break;
          
        default:
          // Forward unknown messages to desktop
          if (ws && ws.readyState === WebSocket.OPEN) {
            const response = await sendMessage(request);
            sendResponse(response);
          } else {
            sendResponse({ error: 'Not connected to desktop app' });
          }
      }
    } catch (error) {
      log('error', `Error handling message ${request.type}`, error);
      sendResponse({ error: error.message });
    }
  };
  
  handleAsync();
  return true; // Keep channel open for async response
});

// ===================== PAIRING HANDLER =====================

/**
 * Handle extension installation or update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  log('info', `Extension ${details.reason}`, { version: chrome.runtime.getManifest().version });
  
  if (details.reason === 'install') {
    // First time installation - open pairing page
    await chrome.storage.local.set({
      'aurasafe_installed': true,
      'aurasafe_install_date': Date.now()
    });
    
    chrome.tabs.create({
      url: chrome.runtime.getURL('pairing.html')
    });
  }
  
  // Start connection attempt
  setTimeout(() => connect(), 1000);
});

/**
 * Handle extension startup (browser launch)
 */
chrome.runtime.onStartup.addListener(() => {
  log('info', 'Browser started, initializing connection');
  setTimeout(() => connect(), 2000);
});

/**
 * Handle before unload
 */
self.addEventListener('beforeunload', () => {
  log('info', 'Extension unloading, cleaning up');
  cleanupWebSocket();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
});

// ===================== EXPORTS (for testing) =====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    connect,
    sendMessage,
    onMessage,
    offMessage,
    getConnectionStatus: () => connectionStatus
  };
}

// ===================== INITIALIZATION =====================
log('info', `AuraSafe Extension v${chrome.runtime.getManifest().version} initialized`);

// Auto-connect on load
connect();

// Export for debugging (available in console)
window.__AURASAFE_EXTENSION__ = {
  connect,
  disconnect: cleanupWebSocket,
  getStatus: () => connectionStatus,
  version: chrome.runtime.getManifest().version,
  CONFIG
};