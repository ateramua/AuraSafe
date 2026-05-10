// src/pages/settings.jsx (UPDATED with Backup and Locked State)
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
import BackupSettings from '../components/BackupSettings';

// Safe link that uses Next.js router if available, otherwise falls back to full page load
function SafeLink({ href, children, className }) {
  const router = useRouter();

  const handleClick = (e) => {
    e.preventDefault();
    if (router && typeof router.push === 'function') {
      router.push(href);
    } else {
      window.location.href = href;
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export default function SettingsPage() {
  const [entries, setEntries] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vaultDataForBackup, setVaultDataForBackup] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncCID, setSyncCID] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);

  // Derived metrics for the dashboard
  const [securityScore, setSecurityScore] = useState(0);
  const [strongPasswords, setStrongPasswords] = useState(0);

  // 🛠️ FIX: Move testBackup INSIDE the component
  const testBackup = async () => {
    console.log('[DEBUG] Testing backup function');
    
    if (window.api && window.api.backupPreVault) {
      try {
        const initResult = await window.api.backupPreVault.initTemp();
        console.log('[DEBUG] initTemp:', initResult);
        
        const result = await window.api.backupPreVault.importFile();
        console.log('[DEBUG] importFile:', result);
        
        if (result.success && result.backupData) {
          alert('Backup loaded!');
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      console.error('backupPreVault not available');
    }
  };

  // Helper to load vault data for backup
  const loadVaultForBackup = async () => {
    const vaultData = await loadVault();
    let entriesArray = [];
    if (Array.isArray(vaultData)) {
      entriesArray = vaultData;
    } else if (vaultData && typeof vaultData === 'object' && Array.isArray(vaultData.entries)) {
      entriesArray = vaultData.entries;
    }
    return { entries: entriesArray, lastModified: Date.now() };
  };

  useEffect(() => {
    const init = async () => {
      const unlockedStatus = await isUnlocked();
      setUnlocked(unlockedStatus);

      // Check if vault is initialized
      if (window.api && typeof window.api.isInitialized === 'function') {
        const initialized = await window.api.isInitialized();
        setIsInitialized(initialized);
      }

      if (unlockedStatus) {
        const vaultData = await loadVault();
        let entriesArray = [];
        if (Array.isArray(vaultData)) {
          entriesArray = vaultData;
        } else if (vaultData && typeof vaultData === 'object' && Array.isArray(vaultData.entries)) {
          entriesArray = vaultData.entries;
        }
        setEntries(entriesArray);
        setVaultDataForBackup({ entries: entriesArray, lastModified: Date.now() });
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

  // Compute security metrics when entries change
  useEffect(() => {
    if (!entries.length) {
      setSecurityScore(0);
      setStrongPasswords(0);
      return;
    }
    const strong = entries.filter(e => e.password && e.password.length >= 8).length;
    setStrongPasswords(strong);
    const score = Math.round((strong / entries.length) * 100);
    setSecurityScore(score);
  }, [entries]);

  // Handle restore completion
  const handleRestoreComplete = async (restoredData) => {
    if (restoredData && restoredData.entries) {
      setEntries(restoredData.entries);
      setVaultDataForBackup({ entries: restoredData.entries, lastModified: Date.now() });
      setSyncMessage('✅ Vault restored successfully! Refreshing...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  // Handle file restore from locked state
  const handleFileRestore = async () => {
    if (window.api && window.api.backupPreVault) {
      await window.api.backupPreVault.initTemp();
      const result = await window.api.backupPreVault.importFile();
      if (result.success && result.backupData) {
        sessionStorage.setItem('pendingRestore', JSON.stringify(result.backupData));
        window.location.href = '/vault';
      } else if (!result.cancelled) {
        alert(result.error || 'Failed to restore backup');
      }
    }
  };

  // Handle iCloud restore from locked state
  const handleICloudRestore = async () => {
    if (window.api && window.api.backupPreVault) {
      await window.api.backupPreVault.initTemp();
      const result = await window.api.backupPreVault.iCloudRestore();
      if (result.success && result.backupData) {
        sessionStorage.setItem('pendingRestore', JSON.stringify(result.backupData));
        window.location.href = '/vault';
      } else {
        alert(result.error || 'No iCloud backup found');
      }
    }
  };

  if (loading) return <div className="loading-spinner">Loading settings...</div>;

  // 🔥 NEW: Show backup options even when vault is locked or not initialized
  if (!unlocked || !isInitialized) {
    return (
      <div className="settings-container">
        <div className="settings-card">
          <div className="security-header">
            <SafeLink href="/vault" className="back-button">
              ← Back to Vault
            </SafeLink>
            <h1>Settings</h1>
          </div>

          <hr className="settings-divider" />

          {/* Backup section - ALWAYS available, even when locked */}
          <div className="setting-section">
            <div className="setting-header">
              <span className="setting-icon">💾</span>
              <h3>Vault Backup & Restore</h3>
            </div>
            <p className="setting-description">
              Restore your vault from a backup file or iCloud.
              This is useful if you're setting up a new device or recovering from data loss.
            </p>

            {/* Backup buttons using backupPreVault API */}
            <div className="button-group" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleFileRestore} className="backup-button" style={{
                padding: '0.7rem 1.5rem',
                background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
                color: '#fff',
                border: 'none',
                borderRadius: '2rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}>
                📂 Restore from File
              </button>
              <button onClick={handleICloudRestore} className="backup-button" style={{
                padding: '0.7rem 1.5rem',
                background: 'rgba(59, 130, 246, 0.8)',
                color: '#fff',
                border: 'none',
                borderRadius: '2rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
              }}>
                ☁️ Restore from iCloud
              </button>
            </div>
          </div>

          <hr className="settings-divider" />

          <div className="locked-message" style={{ textAlign: 'center', padding: '1rem' }}>
            <p style={{ color: '#c8e6c9', marginBottom: '1rem' }}>
              🔒 Vault is {!isInitialized ? 'not initialized' : 'locked'}.
              Unlock to access security settings, biometrics, and IPFS sync.
            </p>
            <SafeLink href="/vault" className="unlock-button" style={{
              background: 'rgba(76, 175, 80, 0.2)',
              border: '1px solid #4caf50',
              color: '#4caf50',
              padding: '0.5rem 1rem',
              borderRadius: '2rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
              Go to Vault to Unlock →
            </SafeLink>
          </div>
        </div>
      </div>
    );
  }

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

  const handleAutoSyncToggle = async () => {
    try {
      const newValue = !autoSyncEnabled;
      await setAutoSync(newValue);
      setAutoSyncEnabled(newValue);
    } catch (err) {
      console.error('Failed to update auto-sync', err);
    }
  };

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

  const handlePull = async () => {
    setSyncLoading(true);
    setSyncMessage('Pulling from IPFS...');
    try {
      const result = await syncPull();
      if (result.success) {
        setSyncMessage('✅ Pull successful. Vault updated.');
        // Refresh entries after pull
        const freshData = await loadVaultForBackup();
        setEntries(freshData.entries);
        setVaultDataForBackup(freshData);
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
    <>
      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .settings-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a2a0a 0%, #0f3a0f 100%);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }

        .settings-card {
          max-width: 1100px;
          width: 100%;
          background: rgba(20, 40, 20, 0.7);
          backdrop-filter: blur(12px);
          border-radius: 2rem;
          padding: 2rem;
          box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(76, 175, 80, 0.3);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .settings-card:hover {
          box-shadow: 0 25px 40px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(76, 175, 80, 0.5);
          transform: translateY(-2px);
        }

        .security-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .back-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(76, 175, 80, 0.5);
          color: #fff;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s ease;
          font-weight: 500;
          text-decoration: none;
          display: inline-block;
        }

        .back-button:hover {
          background: rgba(76, 175, 80, 0.2);
          transform: translateX(-2px);
        }

        h1 {
          font-size: 1.8rem;
          font-weight: 700;
          background: linear-gradient(120deg, #fff, #a5d6a5);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          margin: 0;
        }

        h3 {
          font-size: 1.2rem;
          margin: 0;
          color: #eef5ff;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          background: rgba(30, 50, 30, 0.6);
          backdrop-filter: blur(4px);
          border-radius: 1rem;
          padding: 1.25rem;
          text-align: center;
          border: 1px solid rgba(76, 175, 80, 0.3);
          transition: transform 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-4px);
          border-color: rgba(76, 175, 80, 0.6);
        }

        .metric-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 2rem;
          font-weight: bold;
          color: #fff;
          margin: 0.5rem 0;
        }

        .metric-label {
          font-size: 0.85rem;
          color: #c8e6c9;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          margin-top: 0.75rem;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #4caf50;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .settings-divider {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.4), transparent);
          margin: 1.5rem 0;
        }

        .setting-section {
          margin-bottom: 2rem;
        }

        .setting-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .setting-icon {
          font-size: 1.6rem;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        .setting-description {
          color: #c8e6c9;
          font-size: 0.9rem;
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .setting-status {
          font-size: 0.9rem;
          font-weight: 500;
          color: #a5d6a5;
          background: rgba(76, 175, 80, 0.2);
          padding: 0.2rem 0.6rem;
          border-radius: 1rem;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #2c3a2c;
          transition: 0.3s;
          border-radius: 34px;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background: linear-gradient(145deg, #2e7d32, #1b5e20);
        }

        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }

        .sync-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin: 1rem 0 1rem 0;
        }

        .sync-button {
          padding: 0.7rem 1.5rem;
          border-radius: 2rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.9rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(4px);
          color: #fff;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }

        .sync-button:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.1);
          border-color: #4caf50;
        }

        .sync-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .push-button {
          background: linear-gradient(135deg, #1e3a1e, #2b5e2b);
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .pull-button {
          background: linear-gradient(135deg, #1e3a1e, #2b5e2b);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .sync-cid {
          background: rgba(0, 0, 0, 0.4);
          padding: 0.5rem 1rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          font-family: monospace;
          margin-top: 1rem;
          word-break: break-all;
          color: #c8e6c9;
        }

        .sync-message {
          margin-top: 1rem;
          padding: 0.6rem 1rem;
          border-radius: 1rem;
          font-size: 0.85rem;
          background: rgba(0, 0, 0, 0.3);
          border-left: 3px solid;
        }

        .sync-message.success {
          border-left-color: #4caf50;
          color: #c8e6c9;
        }
        .sync-message.error {
          border-left-color: #ef4444;
          color: #ffbfbf;
        }
        .sync-message.info {
          border-left-color: #3b82f6;
          color: #c7e2ff;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #0a2a0a 0%, #0f3a0f 100%);
          color: #c8e6c9;
          font-size: 1.2rem;
        }
      `}</style>

      <div className="settings-container">
        <div className="settings-card">
          <div className="security-header">
            <SafeLink href="/vault" className="back-button">
              ← Back to Vault
            </SafeLink>
            <h1>Security Dashboard & Settings</h1>
          </div>

          {/* Modern Dashboard Metrics */}
          <div className="dashboard-grid">
            <div className="metric-card">
              <div className="metric-icon">🔐</div>
              <div className="metric-value">{entries.length}</div>
              <div className="metric-label">Total Entries</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">🛡️</div>
              <div className="metric-value">{securityScore}%</div>
              <div className="metric-label">Security Score</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${securityScore}%` }} />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">💪</div>
              <div className="metric-value">{strongPasswords}</div>
              <div className="metric-label">Strong Passwords</div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">🔁</div>
              <div className="metric-value">{syncCID ? 'Active' : 'Off'}</div>
              <div className="metric-label">IPFS Sync</div>
              {syncCID && (
                <div style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: '#a5d6a5' }}>
                  {syncCID.slice(0, 12)}…
                </div>
              )}
            </div>
          </div>

          <hr className="settings-divider" />

          {/* Backup Section - Layer 2 & 3 */}
          <BackupSettings
            api={window.api}
            vaultData={vaultDataForBackup}
            onRestoreComplete={handleRestoreComplete}
          />

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
              {/* 🛠️ FIX: Fixed broken button style */}
              <button onClick={testBackup} style={{
                padding: '0.7rem 1.5rem',
                borderRadius: '2rem',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                background: '#ff9800',
                color: '#000'
              }}>
                🧪 Test Backup (Debug)
              </button>
            </div>
            {syncCID && (
              <div className="sync-cid">
                <strong>Current CID:</strong> <code>{syncCID}</code>
              </div>
            )}
            {syncMessage && (
              <div
                className={`sync-message ${syncMessage.includes('✅') ? 'success' : syncMessage.includes('❌') ? 'error' : 'info'
                  }`}
              >
                {syncMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}