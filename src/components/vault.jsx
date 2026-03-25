// src/views/Vault.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';

export default function Vault() {
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

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

  const saveEntry = async (entryData) => {
    try {
      let updatedEntries;
      if (entryData.id) {
        updatedEntries = entries.map((e) => (e.id === entryData.id ? entryData : e));
        await api.saveVaultEntry(entryData);
      } else {
        const newEntry = { ...entryData, id: Date.now().toString() };
        updatedEntries = [...entries, newEntry];
        await api.saveVaultEntry(newEntry);
      }
      setEntries(updatedEntries);
      setModalOpen(false);
      setEditingEntry(null);
    } catch (err) {
      alert('Failed to save entry: ' + err.message);
    }
  };

  const deleteEntry = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      const updated = await api.deleteVaultEntry(id);
      setEntriesSafe(updated);
    } catch (err) {
      handleError('Failed to delete entry', err);
    }
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

  // ------------------------
  // UI States
  // ------------------------
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Vault</h2>
        <div>
          <button
            style={styles.settingsButton}
            onClick={() => api.navigate('/settings')}
          >
            ⚙️
          </button>
          <button onClick={handleLock} style={styles.lockButton}>
            Lock
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          setEditingEntry(null);
          setModalOpen(true);
        }}
        style={styles.addButton}
      >
        + Add Entry
      </button>

      {entries.length === 0 ? (
        <p>No entries yet.</p>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} style={styles.entryCard}>
            <div style={styles.entryHeader}>
              <strong>{entry.name || 'Unnamed'}</strong>
              <button onClick={() => deleteEntry(entry.id)} style={styles.deleteButton}>
                Delete
              </button>
            </div>
            <div style={styles.entryDetails}>
              <div><strong>Username:</strong> {entry.username || '—'}</div>
              <div><strong>Password:</strong> {entry.password ? '••••••••' : '—'}</div>
              <div><strong>URL:</strong> {entry.url || '—'}</div>
              {entry.notes && <div><strong>Notes:</strong> {entry.notes}</div>}
            </div>
            <div style={styles.entryActions}>
              <button
                onClick={() => {
                  setEditingEntry(entry);
                  setModalOpen(true);
                }}
                style={styles.editButton}
              >
                Edit
              </button>
            </div>
            <div style={styles.syncSection}>
              <button onClick={() => handleSync('push')} style={styles.syncButton}>
                📤 Push
              </button>
              <button onClick={() => handleSync('pull')} style={styles.syncButton}>
                📥 Pull
              </button>
              {/* Sync section */}
              <div style={{ marginTop: '2rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
                <h3>Sync</h3>
                <button onClick={async () => {
                  try {
                    const result = await window.api.sync.push();
                    if (result.success) {
                      alert(`✅ Pushed to IPFS. CID: ${result.cid}`);
                    } else {
                      alert(`❌ Push failed: ${result.error}`);
                    }
                  } catch (err) {
                    alert(`Push error: ${err.message}`);
                  }
                }}>Push to IPFS</button>
                <Link href="/settings">
  <button>⚙️ Settings</button>
</Link>
                <button onClick={async () => {
                  try {
                    const result = await window.api.sync.pull();
                    if (result.success) {
                      alert('✅ Pulled from IPFS');
                    } else {
                      alert(`❌ Pull failed: ${result.error}`);
                    }
                  } catch (err) {
                    alert(`Pull error: ${err.message}`);
                  }
                }}>Pull from IPFS</button>
              </div>
            </div>
            {syncMessage && <div style={styles.syncMessage}>{syncMessage}</div>}
          </div>
        ))
      )}

      <EntryModal
        isOpen={modalOpen}
        entry={editingEntry}
        onClose={() => {
          setModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={saveEntry}
      />
    </div>
  );
}

// styles remain the same
const styles = {
  container: { padding: '2rem', maxWidth: 800, margin: '0 auto', color: '#F3F4F6' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  input: { padding: '0.75rem', width: '100%', marginBottom: '1rem', background: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', color: '#F3F4F6' },
  button: { padding: '0.5rem 1rem', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' },
  lockButton: { marginLeft: 10, background: '#dc3545', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  addButton: { margin: '1rem 0', background: '#28a745', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '0.5rem' },
  entryCard: { border: '1px solid #374151', padding: '1rem', marginBottom: '1rem', borderRadius: '0.5rem', background: '#1F2937' },
  entryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  entryDetails: { fontSize: '0.9rem', marginBottom: '0.5rem', color: '#9CA3AF' },
  entryActions: { display: 'flex', gap: '0.5rem', marginTop: '0.5rem' },
  deleteButton: { background: '#dc3545', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer', borderRadius: '0.25rem' },
  editButton: { background: '#ffc107', color: '#000', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer', borderRadius: '0.25rem' },
  syncSection: { display: 'flex', gap: 10, marginTop: 10 },
  syncButton: { background: '#3B82F6', color: '#fff', border: 'none', padding: '0.25rem 0.5rem', cursor: 'pointer', borderRadius: '0.25rem' },
  syncMessage: { marginTop: 5, fontSize: '0.9rem', color: '#9CA3AF' },
  settingsButton: { marginRight: 10, background: '#6c757d', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '0.5rem' },
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