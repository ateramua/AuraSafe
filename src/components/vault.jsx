import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import CategoryModal from '../components/CategoryModal';
import EntryModal from '../components/EntryModal';
import EntryCard from '../components/EntryCard';

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
          const isUnlocked = await api.isUnlocked();
          setUnlocked(isUnlocked);

          if (isUnlocked) {
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
        return;
      }

      setUnlocked(true);
      setMasterPassword('');

      await loadEntries();
    } catch (err) {
      setUnlockError('Failed to unlock vault. Please try again.');
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
      const syncFn = api?.sync?.[type]; // FIX #1 safe access
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
          <button style={styles.lockButton} onClick={handleLock}>
            Lock
          </button>
        </div>

        <div style={styles.syncToolbar}>
          <button onClick={() => handleSync('push')} disabled={syncLoading}>
            Push
          </button>
          <button onClick={() => handleSync('pull')} disabled={syncLoading}>
            Pull
          </button>
          <span>{syncMessage}</span>
        </div>

        <div style={styles.entriesGrid}>
          {entries.length === 0 ? (
            <p>No entries yet.</p>
          ) : (
            entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={(e) => {
                  setEditingEntry(e);
                  setShowEditModal(true);
                }}
                onDelete={async (id) => {
                  try {
                    await api.deleteVaultEntry(id); // FIX #3
                    await loadEntries();
                  } catch (err) {
                    handleError('Delete failed', err);
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        category={modalCategory}
        api={api}
      />

      <EntryModal
        isOpen={showEditModal}
        entry={editingEntry}
        category="passwords"   // FIX #2
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