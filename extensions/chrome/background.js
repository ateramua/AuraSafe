// ========================
// AuraSafe Background Service Worker (Modernized)
// ========================

const SECRET = 'your-random-secret-here'; // Must match Electron's secret
const TOKEN = 'c298a455aff1df8c171ea210f088256256140397b6b3eca8b70b87855e7dbfb7';

let ws = null;
let reconnectInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max

// Connection state management
let isConnected = false;

/**
 * Establish WebSocket connection to AuraSafe desktop app
 */
function connect() {
  try {
    ws = new WebSocket(`ws://localhost:8765?token=${SECRET}`);
    
    ws.onopen = () => {
      console.log('[AuraSafe] ✅ Connected to desktop app');
      isConnected = true;
      reconnectAttempts = 0;
      
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      
      // Notify any listening popups about connection success
      broadcastConnectionStatus(true);
    };
    
    ws.onerror = (err) => {
      console.error('[AuraSafe] WebSocket error:', err);
      isConnected = false;
      broadcastConnectionStatus(false);
    };
    
    ws.onclose = (event) => {
      console.log(`[AuraSafe] Disconnected (code: ${event.code}), scheduling reconnect...`);
      isConnected = false;
      broadcastConnectionStatus(false);
      
      if (!reconnectInterval) {
        const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;
        console.log(`[AuraSafe] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})`);
        
        reconnectInterval = setInterval(() => {
          connect();
        }, delay);
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[AuraSafe] 📨 Received message:', data.type || 'data');
        
        // Store in Chrome storage for popup access
        chrome.storage.local.set({ 
          lastMessage: data,
          lastUpdated: Date.now(),
          connectionStatus: 'connected'
        });
        
        // Notify popup if open
        chrome.runtime.sendMessage({
          type: 'fromDesktop',
          payload: data,
          timestamp: Date.now()
        }).catch(() => {
          // No popup listening, that's fine
        });
      } catch (err) {
        console.error('[AuraSafe] Failed to parse message:', err);
      }
    };
  } catch (err) {
    console.error('[AuraSafe] Connection error:', err);
    scheduleReconnect();
  }
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectInterval) return;
  
  const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  
  console.log(`[AuraSafe] Scheduling reconnect in ${delay / 1000}s`);
  reconnectInterval = setInterval(() => {
    connect();
  }, delay);
}

/**
 * Broadcast connection status to all extension components
 */
function broadcastConnectionStatus(connected) {
  chrome.storage.local.set({ 
    connectionStatus: connected ? 'connected' : 'disconnected',
    lastHeartbeat: Date.now()
  });
  
  chrome.runtime.sendMessage({
    type: 'connectionStatus',
    connected: connected,
    timestamp: Date.now()
  }).catch(() => {});
}

/**
 * Send message to desktop app via WebSocket
 */
function sendToDesktop(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return { status: 'sent', timestamp: Date.now() };
  } else {
    console.warn('[AuraSafe] Cannot send: WebSocket not open');
    return { status: 'disconnected', error: 'WebSocket not connected' };
  }
}

// Initialize connection
connect();

// ========================
// Chrome Runtime Messaging
// ========================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle "getEntries" request from popup
  if (request.action === 'getEntries') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Request entries from desktop app
      ws.send(JSON.stringify({ action: 'getEntries', token: TOKEN }));
      sendResponse({ status: 'sent', message: 'Request sent to desktop' });
    } else {
      sendResponse({ 
        status: 'disconnected', 
        message: 'Not connected to AuraSafe desktop app' 
      });
    }
    return true;
  }
  
  // Handle direct message forwarding to desktop
  if (request.type === 'forward' || request.action === 'forward') {
    const result = sendToDesktop(request);
    sendResponse(result);
    return true;
  }
  
  // Ping to check connection status
  if (request.action === 'ping') {
    sendResponse({ 
      status: ws && ws.readyState === WebSocket.OPEN ? 'connected' : 'disconnected',
      readyState: ws ? ws.readyState : null
    });
    return true;
  }
  
  // Default: forward any other message to WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(request));
    sendResponse({ status: 'sent' });
  } else {
    sendResponse({ status: 'disconnected' });
  }
  
  return true; // Keep channel open for async response
});

// Optional: Heartbeat to keep service worker alive
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Send heartbeat ping
    try {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } catch (e) {}
  }
}, 25000);

// Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  if (ws) {
    ws.close();
  }
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
});