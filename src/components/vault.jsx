import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import CategoryModal from '../components/CategoryModal';
import EntryModal from '../components/EntryModal';
import RestoreScreen from '../components/RestoreScreen';
import { isInitialized, initVault, unlockVault } from '../lib/api-client';

export default function Vault() {
  const router = useRouter();
  const [initialized, setInitialized] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [unlockError, setUnlockError] = useState(null);
  const [showRestore, setShowRestore] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState(null);

  // State for the category modal
  const [modalCategory, setModalCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const api = typeof window !== 'undefined' ? window.api : null;

  const setEntriesSafe = (data) => setEntries(Array.isArray(data) ? data : []);

  const handleError = (msg, err) => {
    console.error(msg, err);
    setError(`${msg}: ${err.message}`);
  };

  const loadEntries = async () => {
    if (!api) return;
    try {
      const data = await api.getVaultEntries();
      setEntriesSafe(data);
    } catch (err) {
      handleError('Failed to load entries', err);
    }
  };

  useEffect(() => {
    if (!api) return;
    const init = async () => {
      try {
        const isInit = await api.isInitialized();
        setInitialized(isInit);
        
        // Check if there's a pending restore from sessionStorage
        const pending = sessionStorage.getItem('pendingRestore');
        if (pending) {
          setPendingRestoreData(JSON.parse(pending));
          sessionStorage.removeItem('pendingRestore');
        }

        if (isInit) {
          const isUnlocked = await api.isUnlocked();
          setUnlocked(isUnlocked);
          if (isUnlocked) loadEntries();
        }
      } catch (err) {
        handleError('Failed to check vault status', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!api || !initialized || unlocked) return;
    const check = async () => {
      try {
        const available = await api.biometric.isAvailable();
        setBiometricAvailable(available);
        if (available) {
          const enabled = await api.biometric.isEnabled();
          setBiometricEnabled(enabled);
        }
      } catch (err) {
        console.warn('Biometric check failed', err);
      }
    };
    check();
  }, [initialized, unlocked]);

  const handleRestoreComplete = async (backupData) => {
    // Process the backup and create vault
    setPendingRestoreData(backupData);
    // Trigger vault creation with backup data
    if (api && api.restoreFromBackup) {
      await api.restoreFromBackup(backupData);
    }
    window.location.reload();
  };

  const handleCreateNew = () => {
    setShowRestore(false);
    // Show normal initialization screen
  };

  const handleInit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.initVault(masterPassword);
      setInitialized(true);
      setUnlocked(true);
      setMasterPassword('');
      loadEntries();
    } catch (err) {
      handleError('Initialization failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnlockError(null);
    try {
      const res = await api.unlockVault(masterPassword);
      if (!res.success) {
        setUnlockError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }
      setUnlocked(true);
      setEntriesSafe(res.entries);
      setMasterPassword('');
    } catch (err) {
      setUnlockError('Failed to unlock vault. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setLoading(true);
    setUnlockError(null);
    try {
      const res = await api.biometric.unlock();
      if (!res.success) {
        setUnlockError(res.error || 'Biometric unlock failed. Please use master password.');
        setLoading(false);
        return;
      }
      setUnlocked(true);
      setEntriesSafe(res.entries);
    } catch (err) {
      setUnlockError('Biometric unlock error. Please use master password.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    try {
      await api.lockVault();
      setUnlocked(false);
      setEntries([]);
    } catch (err) {
      handleError('Lock failed', err);
    }
  };

  const handlePasswordChange = (e) => {
    setMasterPassword(e.target.value);
    if (unlockError) setUnlockError(null);
  };

  const handleSync = async (type) => {
    setSyncLoading(true);
    setSyncMessage(type === 'push' ? 'Pushing...' : 'Pulling...');
    try {
      const res = await api.sync[type]();
      if (!res.success) {
        setSyncMessage(`❌ ${res.error}`);
        return;
      }
      if (type === 'push') setSyncMessage(`✅ CID: ${res.cid}`);
      else {
        setSyncMessage('✅ Pulled successfully');
        loadEntries();
      }
    } catch (err) {
      setSyncMessage(`❌ ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const openCategoryModal = (categoryId) => {
    setModalCategory(categoryId);
    setIsModalOpen(true);
  };

  // ------------------------
  // UI States
  // ------------------------
  
  // If vault doesn't exist, show restore screen first (Option 1 & 2)
  if (initialized === false && !showRestore) {
    return (
      <RestoreScreen 
        onRestoreComplete={handleRestoreComplete}
        onSkip={handleCreateNew}
      />
    );
  }

  if (loading) return <div style={styles.container}>Loading...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;

  if (!initialized) {
    return (
      <div style={styles.container}>
        <h2>Initialize Vault</h2>
        <form onSubmit={handleInit}>
          <input
            type="password"
            value={masterPassword}
            onChange={handlePasswordChange}
            placeholder="Master password"
            style={styles.input}
          />
          <button style={styles.button}>Create Vault</button>
        </form>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div style={styles.container}>
        <h2>Unlock Vault</h2>
        {unlockError && (
          <div style={styles.errorMessage}>
            <span style={styles.errorIcon}>⚠️</span>
            <span>{unlockError}</span>
          </div>
        )}
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={masterPassword}
            onChange={handlePasswordChange}
            placeholder="Master password"
            style={styles.input}
            autoFocus
          />
          <button style={styles.button} disabled={loading}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
        {biometricAvailable && biometricEnabled && (
          <button
            onClick={handleBiometricUnlock}
            style={{ ...styles.button, background: '#4CAF50', marginTop: 10 }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Unlock with Biometric'}
          </button>
        )}
      </div>
    );
  }

  // Unlocked view: sidebar + main area (welcome & sync)
  return (
    <div style={styles.mainContainer}>
      <Sidebar selectedCategory={null} onOpenCategory={openCategoryModal} />
      <div style={styles.content}>
        <div style={styles.header}>
          <h2>AuraSafe Vault</h2>
          <div style={styles.headerActions}>
            <button onClick={handleLock} style={styles.lockButton}>
              Lock
            </button>
          </div>
        </div>

        {/* Sync Toolbar */}
        <div style={styles.syncToolbar}>
          <button
            onClick={() => handleSync('push')}
            disabled={syncLoading}
            style={styles.syncButton}
          >
            {syncLoading ? 'Pushing...' : '📤 Push to IPFS'}
          </button>
          <button
            onClick={() => handleSync('pull')}
            disabled={syncLoading}
            style={styles.syncButton}
          >
            {syncLoading ? 'Pulling...' : '📥 Pull from IPFS'}
          </button>
          {syncMessage && <div style={styles.syncMessage}>{syncMessage}</div>}
        </div>

        {/* Welcome message */}
        <div style={styles.welcome}>
          <p>Click on any category in the sidebar to view and manage your items.</p>
          <p>Use the buttons above to sync your vault with IPFS.</p>
        </div>
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={modalCategory}
        api={api}
      />
    </div>
  );
}

// Updated styles (includes new ones, keeps all necessary ones)
const styles = {
  mainContainer: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#0a5c2e',
  },
  content: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto',
    marginLeft: '280px', // matches sidebar width
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  headerActions: {
    display: 'flex',
    gap: '1rem',
  },
  lockButton: {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '0.5rem',
  },
  syncToolbar: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  syncButton: {
    background: '#3B82F6',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
    ':hover': {
      background: '#2563EB',
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  syncMessage: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
  },
  welcome: {
    textAlign: 'center',
    padding: '3rem',
    color: '#c8e6c9',
    fontSize: '1.1rem',
    background: 'rgba(30, 50, 30, 0.6)',
    borderRadius: '1rem',
    backdropFilter: 'blur(4px)',
    marginTop: '2rem',
  },
  // Styles for initialization/unlock screens (unchanged)
  container: {
    padding: '2rem',
    maxWidth: 800,
    margin: '0 auto',
    color: '#F3F4F6',
  },
  input: {
    padding: '0.75rem',
    width: '100%',
    marginBottom: '1rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
  },
  button: {
    padding: '0.5rem 1rem',
    background: '#3B82F6',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
  },
  errorMessage: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '20px',
    color: '#991b1b',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
  },
  errorIcon: { fontSize: '1.2rem' },
};