const SECRET = 'your-random-secret-here'; // Must match Electron's secret
let ws = null;
let reconnectInterval = null;

function connect() {
  ws = new WebSocket(`ws://localhost:8765?token=${SECRET}`);
  ws.onopen = () => {
    console.log('Connected to AuraSafe desktop app');
    if (reconnectInterval) clearInterval(reconnectInterval);
  };
  ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };
  ws.onclose = () => {
    console.log('Disconnected, trying to reconnect in 5s');
    reconnectInterval = setInterval(connect, 5000);
  };
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Forward message to popup or store in local storage
    chrome.storage.local.set({ lastMessage: data });
    // Notify popup if open
    chrome.runtime.sendMessage(data);
  };
}

connect();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(request));
    // Wait for response? We'll handle via onmessage
    sendResponse({ status: 'sent' });
  } else {
    sendResponse({ status: 'disconnected' });
  }
  return true; // Keep channel open for async response
});