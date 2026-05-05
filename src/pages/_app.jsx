// src/pages/_app.jsx
import '../styles/globals.css';
import { useEffect, useState } from 'react';

// Create a safe API wrapper for both Electron and web modes
const createSafeAPI = () => {
  // Check if we're in Electron mode with proper API
  const isElectron = typeof window !== 'undefined' && 
                     process.env.NEXT_PUBLIC_IS_ELECTRON === 'true' &&
                     !!window.api;
  
  // Create mock API for web development
  const mockAPI = {
    isElectron: false,
    initVault: async (password) => {
      console.log('[Mock] initVault called with password:', password ? '***' : 'undefined');
      return true;
    },
    isInitialized: async () => {
      console.log('[Mock] isInitialized called');
      return false;
    },
    unlockVault: async (password) => {
      console.log('[Mock] unlockVault called');
      return { success: true };
    },
    isUnlocked: async () => {
      console.log('[Mock] isUnlocked called');
      return true;
    },
    lockVault: async () => {
      console.log('[Mock] lockVault called');
      return true;
    },
    getVaultEntries: async () => {
      console.log('[Mock] getVaultEntries called');
      return [];
    },
    saveVaultEntry: async (entry) => {
      console.log('[Mock] saveVaultEntry called', entry);
      return { success: true };
    },
    deleteVaultEntry: async (id) => {
      console.log('[Mock] deleteVaultEntry called', id);
      return { success: true };
    },
    onVaultStatusChange: (callback) => {
      console.log('[Mock] onVaultStatusChange registered');
      // Simulate unlocked status after 100ms
      setTimeout(() => callback({ unlocked: true }), 100);
    },
    // Additional methods from your preload script
    changePassword: async (currentPassword, newPassword) => {
      console.log('[Mock] changePassword called');
      return { success: true };
    },
    generatePairingCode: async () => {
      console.log('[Mock] generatePairingCode called');
      return { secret: 'mock-secret-123' };
    },
    verifyPairingCode: async (secret) => {
      console.log('[Mock] verifyPairingCode called');
      return { valid: true };
    },
    getPasskeys: async () => {
      console.log('[Mock] getPasskeys called');
      return { success: true, data: [] };
    },
    savePasskey: async (passkeyData) => {
      console.log('[Mock] savePasskey called');
      return { success: true };
    },
    deletePasskey: async (id) => {
      console.log('[Mock] deletePasskey called');
      return { success: true };
    },
    biometric: {
      isAvailable: async () => false,
      isEnabled: async () => false,
      enable: async () => false,
      disable: async () => false,
      unlock: async () => ({ success: false, error: 'Not available in web mode' })
    },
    sync: {
      push: async () => ({ success: false, error: 'Sync not available in web mode' }),
      pull: async () => ({ success: false, error: 'Sync not available in web mode' }),
      getCID: async () => null
    },
    settings: {
      getAutoSync: async () => false,
      setAutoSync: async (enabled) => true
    }
  };

  // Return real Electron API or mock
  return isElectron ? window.api : mockAPI;
};

// Global API instance that components can import
export const api = createSafeAPI();

// For debugging - expose to window in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.debugAPI = api;
  console.log('[App] API exposed to window.debugAPI for debugging');
  console.log('[App] Running in:', api.isElectron ? 'Electron mode' : 'Web mode');
  console.log('[App] Available API methods:', Object.keys(api));
}

export default function App({ Component, pageProps }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize vault when app loads
    const initializeApp = async () => {
      try {
        console.log('[App] Initializing application...');
        
        // Check if vault is initialized
        const isInit = await api.isInitialized();
        console.log('[App] Vault initialized:', isInit);
        
        if (!isInit) {
          // For demo purposes, you might want to create a default vault
          // or show an initialization screen
          console.log('[App] Vault not initialized - showing setup screen');
        }
        
        setIsReady(true);
      } catch (err) {
        console.error('[App] Initialization error:', err);
        setError(err.message);
        // Still set ready to show UI, but with error state
        setIsReady(true);
      }
    };

    initializeApp();

    // Optional: Listen for vault status changes
    if (api.onVaultStatusChange) {
      api.onVaultStatusChange((status) => {
        console.log('[App] Vault status changed:', status);
        // You can add global state management here if needed
      });
    }
  }, []);

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <h1 style={{ color: '#ef4444' }}>⚠️ Initialization Error</h1>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Reload Application
        </button>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#64748b'
      }}>
        <div>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid #e2e8f0', 
            borderTopColor: '#3b82f6', 
            borderRadius: '50%', 
            animation: 'spin 0.6s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>Initializing AuraSafe...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return <Component {...pageProps} />;
}