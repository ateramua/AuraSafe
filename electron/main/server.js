import { WebSocketServer } from "ws";

const PORT = 8765;

// Store connected clients
const clients = new Set();

// This will be set by main.js
let getDatabaseFunction = null;

// Function to set the database getter from main.js
export function setDatabaseGetter(getter) {
  getDatabaseFunction = getter;
  console.log('[WebSocket] Database getter registered');
}

// Function to get credentials from database
async function getCredentialsFromDatabase() {
  if (!getDatabaseFunction) {
    console.log('[WebSocket] No database getter registered');
    return [];
  }
  
  try {
    const database = await getDatabaseFunction();
    if (database) {
      const tableCheck = await database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='vault_entries'");
      if (tableCheck) {
        const entries = await database.all('SELECT * FROM vault_entries ORDER BY created_at DESC');
        return entries || [];
      }
    }
    return [];
  } catch (err) {
    console.error('[WebSocket] Error getting credentials:', err);
    return [];
  }
}

// Function to broadcast vault status to all connected clients
export function broadcastVaultStatus(unlocked) {
  const message = JSON.stringify({
    type: 'VAULT_STATUS_CHANGED',
    payload: { unlocked: unlocked, timestamp: Date.now() }
  });
  
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
  console.log(`[WebSocket] Broadcast vault status: ${unlocked ? 'Unlocked' : 'Locked'} to ${clients.size} clients`);
}

// Function to broadcast credentials update
export function broadcastCredentialsUpdate(entries) {
  const message = JSON.stringify({
    type: 'credentials',
    payload: entries || []
  });
  
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
  console.log(`[WebSocket] Broadcast credentials update to ${clients.size} clients`);
}

function startWebSocketServer() {
  const wss = new WebSocketServer({ port: PORT });

  wss.on("connection", async (ws, req) => {
    // Add client to set
    clients.add(ws);
    console.log(`[WebSocket] Client connected, total clients: ${clients.size}`);

    // Send initial connection confirmation
    ws.send(JSON.stringify({ type: 'connection', status: 'paired' }));

    // Send credentials immediately on connection
    try {
      const entries = await getCredentialsFromDatabase();
      ws.send(JSON.stringify({
        type: 'credentials',
        payload: entries
      }));
      console.log(`[WebSocket] Sent ${entries.length} credentials to new client`);
    } catch (err) {
      console.error('[WebSocket] Error sending initial credentials:', err);
    }

    ws.on("message", async (msg) => {
      try {
        const message = JSON.parse(msg.toString());
        console.log("[WebSocket] Received message type:", message.type);
        
        // Handle GET_CREDENTIALS request
        if (message.type === 'GET_CREDENTIALS') {
          console.log("[WebSocket] Handling GET_CREDENTIALS request");
          const entries = await getCredentialsFromDatabase();
          
          const response = JSON.stringify({
            type: 'credentials',
            payload: entries,
            id: message.id
          });
          ws.send(response);
          console.log(`[WebSocket] Sent ${entries.length} credentials in response`);
        }
        
        // Handle GET_STATUS request
        if (message.type === 'GET_STATUS') {
          console.log("[WebSocket] Handling GET_STATUS request");
          const entries = await getCredentialsFromDatabase();
          const response = JSON.stringify({
            type: 'VAULT_STATUS_CHANGED',
            payload: { 
              unlocked: true,  // You can track actual vault state here
              timestamp: Date.now(),
              credentials: entries
            },
            id: message.id
          });
          ws.send(response);
          console.log("[WebSocket] Sent status response");
        }
        
        // Handle PING
        if (message.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now(), id: message.id }));
        }
        
      } catch (err) {
        console.error("[WebSocket] Error parsing message:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WebSocket] Client disconnected, total clients: ${clients.size}`);
    });
    
    ws.on("error", (err) => {
      console.error("[WebSocket] Error:", err);
      clients.delete(ws);
    });
  });

  console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);

  return wss;
}

// Start the server
const webSocketServer = startWebSocketServer();

export { webSocketServer, clients };
export default startWebSocketServer;