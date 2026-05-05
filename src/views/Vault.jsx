import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import CategoryModal from '../components/CategoryModal';
import EntryModal from '../components/EntryModal';

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

  const [modalCategory, setModalCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingEntry, setEditingEntry] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const api = typeof window !== 'undefined' ? window.api : null;

  const setEntriesSafe = (data) =>
    setEntries(Array.isArray(data) ? data : []);

  const handleError = (msg, err) => {
    console.error(msg, err);
    setError(`${msg}: ${err?.message || err}`);
  };

  const loadEntries = useCallback(async () => {
    if (!api) return;
    try {
      const data = await api.getVaultEntries();
      setEntriesSafe(data);
    } catch (err) {
      handleError('Failed to load entries', err);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;

    const init = async () => {
      try {
        const isInit = await api.isInitialized();
        setInitialized(isInit);

        if (isInit) {
          const isUnlockedStatus = await api.isUnlocked();
          setUnlocked(isUnlockedStatus);

          if (isUnlockedStatus) {
            await loadEntries();
          }
        }
      } catch (err) {
        handleError('Failed to check vault status', err);
      }
    };

    init();
  }, [api, loadEntries]);

  const handleInit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.initVault(masterPassword);

      setInitialized(true);
      setUnlocked(true);
      setMasterPassword('');

      await loadEntries();
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

      const status = await api.isUnlocked();
      console.log('[Vault] Global unlock status:', status);

      setUnlocked(true);
      setMasterPassword('');
      await loadEntries();
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
        setUnlockError(res.error || 'Biometric unlock failed.');
        setLoading(false);
        return;
      }

      setUnlocked(true);
      await loadEntries();
    } catch (err) {
      setUnlockError('Biometric unlock error.');
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

  const handleSync = async (type) => {
    setSyncLoading(true);
    setSyncMessage(type === 'push' ? 'Pushing...' : 'Pulling...');

    try {
      const syncFn = api?.sync?.[type];
      if (!syncFn) throw new Error(`Sync method not found: ${type}`);

      const res = await syncFn();

      if (!res.success) {
        setSyncMessage(`❌ ${res.error}`);
        return;
      }

      if (type === 'push') {
        setSyncMessage(`✅ CID: ${res.cid}`);
      } else {
        setSyncMessage('✅ Pulled successfully');
        await loadEntries();
      }
    } catch (err) {
      setSyncMessage(`❌ ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSaveEdit = async (updatedEntry) => {
    try {
      await api.saveVaultEntry(updatedEntry);
      setShowEditModal(false);
      setEditingEntry(null);
      await loadEntries();
    } catch (err) {
      alert('Failed to update entry: ' + err.message);
    }
  };

  if (loading && !unlocked)
    return <div style={styles.container}>Loading...</div>;

  if (error) return <div style={styles.container}>Error: {error}</div>;

  if (!initialized) {
    return (
      <div style={styles.container}>
        <h2>Initialize Vault</h2>
        <form onSubmit={handleInit}>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
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
            <span>⚠️</span>
            <span>{unlockError}</span>
          </div>
        )}

        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            placeholder="Master password"
            style={styles.input}
          />

          <button style={styles.button}>
            {loading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        {biometricAvailable && biometricEnabled && (
          <button
            onClick={handleBiometricUnlock}
            style={{ ...styles.button, marginTop: 10, background: '#4CAF50' }}
          >
            Biometric Unlock
          </button>
        )}
      </div>
    );
  }

  // Unlocked view - NO ENTRIES displayed here, only welcome message
  return (
    <div style={styles.mainContainer}>
      <Sidebar
        onOpenCategory={(id) => {
          setModalCategory(id);
          setIsModalOpen(true);
        }}
      />

      <div style={styles.content}>
        <div style={styles.header}>
          <h2>AuraSafe Vault</h2>
          <div>
            <button style={styles.settingsButton} onClick={() => router.push('/settings')}>
              ⚙️
            </button>
            <button style={styles.lockButton} onClick={handleLock}>
              Lock
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

        {/* Welcome message - NO entries displayed here */}
        <div style={styles.welcome}>
          <p>🔐 Welcome to AuraSafe Vault</p>
          <p>Click on any category in the sidebar to view and manage your items.</p>
          <p>Use the buttons above to sync your vault with IPFS.</p>
        </div>
      </div>

      {/* CategoryModal handles displaying entries when categories are clicked */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={modalCategory}
        api={api}
      />

      <EntryModal
        isOpen={showEditModal}
        entry={editingEntry}
        category="passwords"
        onClose={() => {
          setShowEditModal(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEdit}
        zIndex={2100}
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
};