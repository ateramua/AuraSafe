import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import CategoryModal from '../components/CategoryModal';

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
  const [pendingRestoreData, setPendingRestoreData] = useState(null);

  // Modal state
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

        // Check for pending restore data
        const pendingRestore = typeof window !== 'undefined' ? sessionStorage.getItem('pendingRestore') : null;
        if (pendingRestore) {
          try {
            const backupData = JSON.parse(pendingRestore);
            // Extract the actual vault data from the backup container
            const vaultData = backupData.data || backupData;
            setPendingRestoreData(vaultData);
            sessionStorage.removeItem('pendingRestore'); // Clear it
          } catch (err) {
            console.error('Failed to parse pending restore data:', err);
            sessionStorage.removeItem('pendingRestore'); // Clear invalid data
          }
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

  const handleInit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.initVault(masterPassword);
      setInitialized(true);
      setUnlocked(true);
      
      // If we have pending restore data, import the entries
      if (pendingRestoreData && pendingRestoreData.entries) {
        const entries = pendingRestoreData.entries;
        for (const entry of entries) {
          try {
            await api.saveVaultEntry(entry);
          } catch (err) {
            console.error('Failed to save restored entry:', err);
          }
        }
        setEntriesSafe(entries);
        setPendingRestoreData(null);
      } else {
        // Create empty vault
        setEntries([]);
      }
      
      setMasterPassword('');
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
  if (loading) return <div style={styles.container}>Loading...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;

  if (!initialized) {
    const isRestore = pendingRestoreData && pendingRestoreData.entries;
    return (
      <div style={styles.container}>
        <h2>{isRestore ? 'Restore Vault from Backup' : 'Initialize Vault'}</h2>
        {isRestore && (
          <div style={styles.restoreInfo}>
            <p>Found backup data with {pendingRestoreData.entries.length} entries.</p>
            <p>Enter a master password to restore your vault.</p>
          </div>
        )}
        <form onSubmit={handleInit}>
          <input
            type="password"
            value={masterPassword}
            onChange={handlePasswordChange}
            placeholder="Master password"
            style={styles.input}
          />
          <button style={styles.button}>
            {isRestore ? 'Restore Vault' : 'Create Vault'}
          </button>
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

  // Unlocked view
  return (
    <div style={styles.mainContainer}>
      <Sidebar onOpenCategory={openCategoryModal} />
      <div style={styles.content}>
        <div style={styles.header}>
          <h2>AuraSafe Vault</h2>
          <div>
            <button style={styles.settingsButton} onClick={() => router.push('/settings')}>
              ⚙️
            </button>
            <button onClick={handleLock} style={styles.lockButton}>
              Lock
            </button>
            <button onClick={handleLock} style={styles.logoutButton}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Sync Toolbar */}
        <div style={styles.syncToolbar}>
          <button onClick={() => handleSync('push')} disabled={syncLoading} style={styles.syncButton}>
            {syncLoading ? 'Pushing...' : '📤 Push to IPFS'}
          </button>
          <button onClick={() => handleSync('pull')} disabled={syncLoading} style={styles.syncButton}>
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  settingsButton: {
    marginRight: 10,
    background: '#6c757d',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '0.5rem',
  },
  lockButton: {
    marginLeft: 10,
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
  },
  logoutButton: {
    marginLeft: 10,
    background: '#f97316',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '0.5rem',
  },
  syncToolbar: {
    display: 'flex',
    gap: 10,
    margin: '1rem 0',
    alignItems: 'center',
  },
  syncButton: {
    background: '#3B82F6',
    color: '#fff',
    border: 'none',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderRadius: '0.5rem',
  },
  syncMessage: {
    marginLeft: '1rem',
    fontSize: '0.9rem',
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
  restoreInfo: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid #3B82F6',
    borderRadius: '0.5rem',
    padding: '1rem',
    marginBottom: '1rem',
    color: '#c8e6c9',
  },
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