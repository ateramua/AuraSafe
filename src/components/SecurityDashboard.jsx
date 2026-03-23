// // 
// {/* <SecurityDashboard entries={entries} /> */}
// <div style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '8px' }}>
//   <h3>Security Dashboard</h3>
//   <p>Number of entries: {entries.length}</p>
// </div>

// src/pages/settings.jsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  isUnlocked,
  getSyncCID,
  syncPush,
  syncPull,
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  getAutoSync,
  setAutoSync,
} from '../lib/api-client';
import { loadVault } from '../lib/store';

export default function SettingsPage() {
  const [entries, setEntries] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncCID, setSyncCID] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // Load vault, biometric, auto-sync, and sync CID
  useEffect(() => {
    const init = async () => {
      const unlockedStatus = await isUnlocked();
      setUnlocked(unlockedStatus);

      if (unlockedStatus) {
        let vaultData = await loadVault();
        // Ensure we have an array (some versions may return { entries: [...] })
        if (vaultData && typeof vaultData === 'object') {
          if (Array.isArray(vaultData)) {
            setEntries(vaultData);
          } else if (vaultData.entries && Array.isArray(vaultData.entries)) {
            setEntries(vaultData.entries);
          } else {
            setEntries([]);
          }
        } else {
          setEntries([]);
        }
      }

      try {
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);
        if (available) {
          const enabled = await isBiometricEnabled();
          setBiometricEnabled(enabled);
        }

        const auto = await getAutoSync();
        setAutoSyncEnabled(auto);

        const cid = await getSyncCID();
        if (cid) setSyncCID(cid);
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <div className="loading-spinner">Loading settings...</div>;

  if (!unlocked) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Vault Locked</h2>
          <p>Please unlock your vault to view security settings and insights.</p>
          <Link href="/vault">
            <button className="back-button">← Go to Vault</button>
          </Link>
        </div>
      </div>
    );
  }

  // Biometric toggle
  const handleBiometricToggle = async () => {
    setSyncMessage('');
    try {
      if (biometricEnabled) {
        const success = await disableBiometric();
        if (success) setBiometricEnabled(false);
        else setSyncMessage('Failed to disable biometric unlock');
      } else {
        const success = await enableBiometric();
        if (success) setBiometricEnabled(true);
        else setSyncMessage('Failed to enable biometric unlock. Ensure Touch ID is set up.');
      }
    } catch (err) {
      setSyncMessage('An error occurred');
    }
  };

  // Auto-sync toggle
  const handleAutoSyncToggle = async () => {
    try {
      const newValue = !autoSyncEnabled;
      await setAutoSync(newValue);
      setAutoSyncEnabled(newValue);
    } catch (err) {
      console.error('Failed to update auto-sync', err);
    }
  };

  // IPFS Push
  const handlePush = async () => {
    setSyncLoading(true);
    setSyncMessage('Pushing to IPFS...');
    try {
      const result = await syncPush();
      if (result.success) {
        setSyncCID(result.cid);
        setSyncMessage(`✅ Pushed successfully. CID: ${result.cid}`);
      } else {
        setSyncMessage(`❌ Push failed: ${result.error}`);
      }
    } catch (err) {
      setSyncMessage(`❌ Push error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // IPFS Pull
  const handlePull = async () => {
    setSyncLoading(true);
    setSyncMessage('Pulling from IPFS...');
    try {
      const result = await syncPull();
      if (result.success) {
        setSyncMessage('✅ Pull successful. Vault updated.');
      } else {
        setSyncMessage(`❌ Pull failed: ${result.error}`);
      }
    } catch (err) {
      setSyncMessage(`❌ Pull error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-card">
        <div className="security-header">
          <Link href="/vault">
            <button className="back-button">← Back to Vault</button>
          </Link>
          <h1>Security Dashboard & Settings</h1>
        </div>

        {/* Simple dashboard placeholder */}
        <div style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '8px', marginBottom: '1rem' }}>
          <h3>Security Dashboard</h3>
          <p>Number of entries: {entries.length}</p>
        </div>

        <hr className="settings-divider" />

        {/* Biometric Section */}
        <div className="setting-section">
          <div className="setting-header">
            <span className="setting-icon">🔐</span>
            <h3>Biometric Unlock</h3>
          </div>
          <p className="setting-description">
            {biometricAvailable
              ? 'Use your fingerprint or face to quickly unlock the vault.'
              : 'Biometric authentication is not available on this device.'}
          </p>
          {biometricAvailable && (
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" checked={biometricEnabled} onChange={handleBiometricToggle} />
                <span className="toggle-slider"></span>
              </label>
              <span className="setting-status">{biometricEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          )}
        </div>

        <hr className="settings-divider" />

        {/* Auto-sync Section */}
        <div className="setting-section">
          <div className="setting-header">
            <span className="setting-icon">🔁</span>
            <h3>Auto-sync</h3>
          </div>
          <p className="setting-description">
            Automatically push changes to IPFS after modifying the vault.
          </p>
          <div className="setting-control">
            <label className="toggle-switch">
              <input type="checkbox" checked={autoSyncEnabled} onChange={handleAutoSyncToggle} />
              <span className="toggle-slider"></span>
            </label>
            <span className="setting-status">{autoSyncEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>

        <hr className="settings-divider" />

        {/* IPFS Sync Section */}
        <div className="setting-section">
          <div className="setting-header">
            <span className="setting-icon">🔄</span>
            <h3>IPFS Sync</h3>
          </div>
          <p className="setting-description">
            Push your encrypted vault to IPFS to share across devices, or pull a previously uploaded vault.
          </p>
          <div className="sync-buttons">
            <button onClick={handlePush} disabled={syncLoading} className="sync-button push-button">
              {syncLoading ? 'Pushing...' : '📤 Push to IPFS'}
            </button>
            <button onClick={handlePull} disabled={syncLoading} className="sync-button pull-button">
              {syncLoading ? 'Pulling...' : '📥 Pull from IPFS'}
            </button>
          </div>
          {syncCID && (
            <div className="sync-cid">
              <strong>Current CID:</strong> <code>{syncCID}</code>
            </div>
          )}
          {syncMessage && (
            <div className={`sync-message ${syncMessage.includes('✅') ? 'success' : syncMessage.includes('❌') ? 'error' : 'info'}`}>
              {syncMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}