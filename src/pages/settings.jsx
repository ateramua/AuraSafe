// src/pages/settings.jsx
import { useState, useEffect } from 'react';
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
  changePassword,
} from '../lib/api-client';
import { loadVault, getVaultStats, clearLocalData } from '../lib/store';

export default function SettingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Settings states
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoLock, setAutoLock] = useState(5);
  const [syncCID, setSyncCID] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);

  // Metrics
  const [securityScore, setSecurityScore] = useState(0);
  const [strongPasswords, setStrongPasswords] = useState(0);
  const [weakPasswords, setWeakPasswords] = useState(0);
  const [reusedPasswords, setReusedPasswords] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Load settings from storage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('aurasafe_dark_mode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
      if (savedDarkMode === 'true') {
        document.body.classList.add('dark-mode');
      }
    }
    const savedAutoLock = localStorage.getItem('aurasafe_auto_lock');
    if (savedAutoLock) setAutoLock(parseInt(savedAutoLock));
  }, []);

  // ================= INIT =================
  useEffect(() => {
    setMounted(true);

    const init = async () => {
      try {
        const vaultData = await loadVault();
        const entriesArray = Array.isArray(vaultData) ? vaultData : vaultData?.entries || [];
        setEntries(entriesArray);

        // Calculate detailed metrics
        const passwords = entriesArray.filter(e => e.password).map(e => e.password);
        const strong = passwords.filter(p => p && p.length >= 12 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)).length;
        const weak = passwords.filter(p => p && p.length < 8).length;
        const unique = new Set(passwords).size;
        const reused = passwords.length - unique;

        setStrongPasswords(strong);
        setWeakPasswords(weak);
        setReusedPasswords(reused);
        setSecurityScore(Math.round((strong / (passwords.length || 1)) * 100));
        setTotalSize(JSON.stringify(entriesArray).length);

        const vaultStats = await getVaultStats();
        setStats(vaultStats);

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

        // Check last backup
        const lastBackupTime = localStorage.getItem('aurasafe_last_backup');
        if (lastBackupTime) setLastBackup(parseInt(lastBackupTime));
      } catch (err) {
        console.error('[Settings] Init failed:', err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // ================= METRICS =================
  useEffect(() => {
    if (!entries.length) {
      setSecurityScore(0);
      setStrongPasswords(0);
      setWeakPasswords(0);
      setReusedPasswords(0);
      return;
    }
    const passwords = entries.filter(e => e.password).map(e => e.password);
    const strong = passwords.filter(p => p && p.length >= 12 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)).length;
    const weak = passwords.filter(p => p && p.length < 8).length;
    const unique = new Set(passwords).size;
    const reused = passwords.length - unique;

    setStrongPasswords(strong);
    setWeakPasswords(weak);
    setReusedPasswords(reused);
    setSecurityScore(Math.round((strong / (passwords.length || 1)) * 100));
  }, [entries]);

  // ================= ACTIONS =================
  const handleBiometricToggle = async () => {
    try {
      if (biometricEnabled) {
        const success = await disableBiometric();
        if (success) {
          setBiometricEnabled(false);
          showToast('Biometric unlock disabled', 'success');
        } else showToast('Failed to disable biometric unlock', 'error');
      } else {
        const success = await enableBiometric();
        if (success) {
          setBiometricEnabled(true);
          showToast('Biometric unlock enabled', 'success');
        } else showToast('Failed to enable biometric unlock', 'error');
      }
    } catch {
      showToast('An error occurred', 'error');
    }
  };

  const handleAutoSyncToggle = async () => {
    try {
      const newValue = !autoSyncEnabled;
      await setAutoSync(newValue);
      setAutoSyncEnabled(newValue);
      showToast(`Auto-sync ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      showToast('Failed to update auto-sync', 'error');
    }
  };

  const handleDarkModeToggle = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('aurasafe_dark_mode', newValue);
    if (newValue) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    showToast(`Dark mode ${newValue ? 'enabled' : 'disabled'}`, 'success');
  };

  const handleAutoLockChange = (e) => {
    const value = parseInt(e.target.value);
    setAutoLock(value);
    localStorage.setItem('aurasafe_auto_lock', value);
    showToast(`Auto-lock set to ${value} minutes`, 'success');
  };

  const handlePush = async () => {
    setSyncLoading(true);
    setSyncMessage('Pushing to IPFS...');
    try {
      const result = await syncPush();
      if (result.success) {
        setSyncCID(result.cid);
        setSyncMessage(`✅ Pushed successfully`);
        showToast('Vault pushed to IPFS', 'success');
      } else {
        setSyncMessage(`❌ Push failed: ${result.error}`);
        showToast('Push failed', 'error');
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
        setSyncMessage('✅ Pull successful');
        showToast('Vault pulled from IPFS', 'success');
        const vaultData = await loadVault();
        setEntries(Array.isArray(vaultData) ? vaultData : vaultData?.entries || []);
      } else {
        setSyncMessage(`❌ Pull failed: ${result.error}`);
        showToast('Pull failed', 'error');
      }
    } catch (err) {
      setSyncMessage(`❌ Pull error: ${err.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await loadVault();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aurasafe_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      localStorage.setItem('aurasafe_last_backup', Date.now().toString());
      setLastBackup(Date.now());
      showToast('Vault exported successfully', 'success');
      setShowExportModal(false);
    } catch (err) {
      showToast('Failed to export vault', 'error');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);
      const entries = Array.isArray(importedData) ? importedData : importedData.entries || [];
      
      for (const entry of entries) {
        await window.api.saveVaultEntry(entry);
      }
      
      showToast(`Imported ${entries.length} entries successfully`, 'success');
      const vaultData = await loadVault();
      setEntries(Array.isArray(vaultData) ? vaultData : vaultData?.entries || []);
    } catch (err) {
      showToast('Failed to import vault', 'error');
    }
  };

  const handleClearData = async () => {
    try {
      await clearLocalData();
      showToast('Local data cleared successfully', 'success');
      setShowConfirmModal(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast('Failed to clear data', 'error');
    }
  };

  const handleLock = async () => {
    if (window.api) {
      await window.api.lockVault();
      router.push('/vault');
    }
  };

  // Password Change Modal Component
  const ChangePasswordModal = ({ isOpen, onClose }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [strength, setStrength] = useState({ score: 0, label: '', color: '#ef4444' });

    const checkStrength = (password) => {
      let score = 0;
      if (password.length >= 8) score++;
      if (password.length >= 12) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      
      const percent = Math.min(score * 20, 100);
      let label = 'Weak';
      let color = '#ef4444';
      if (percent > 60) { label = 'Good'; color = '#eab308'; }
      if (percent > 80) { label = 'Strong'; color = '#22c55e'; }
      setStrength({ score: percent, label, color });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
      if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
      }
      setLoading(true);
      try {
        const result = await changePassword(currentPassword, newPassword);
        if (result.success) {
          showToast('Password changed successfully!', 'success');
          onClose();
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          showToast(result.error || 'Failed to change password', 'error');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (!isOpen) return null;

    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h3>Change Master Password</h3>
            <button onClick={onClose} style={styles.modalClose}>×</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGroup}>
              <label>Current Password</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={styles.formInput}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={styles.eyeButton}>
                  {showCurrent ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label>New Password</label>
              <div style={styles.passwordWrapper}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); checkStrength(e.target.value); }}
                  required
                  style={styles.formInput}
                />
                <button type="button" onClick={() => setShowNew(!showNew)} style={styles.eyeButton}>
                  {showNew ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {newPassword && (
                <div style={styles.strengthBar}>
                  <div style={{ width: `${strength.score}%`, background: strength.color, height: '4px', borderRadius: '2px', transition: 'width 0.3s' }} />
                  <span style={{ color: strength.color, fontSize: '11px' }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div style={styles.formGroup}>
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={styles.formInput}
              />
            </div>
            <div style={styles.modalActions}>
              <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
              <button type="submit" disabled={loading} style={styles.saveBtn}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Export Modal
  const ExportModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h3>Export Vault</h3>
            <button onClick={onClose} style={styles.modalClose}>×</button>
          </div>
          <p>This will export all your vault entries as a JSON file.</p>
          <p style={{ fontSize: '12px', color: '#f59e0b' }}>⚠️ Keep this file secure. It contains all your passwords in plain text.</p>
          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="button" onClick={handleExport} style={styles.saveBtn}>Export Vault</button>
          </div>
        </div>
      </div>
    );
  };

  // Confirm Modal
  const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
      <div style={styles.modalOverlay} onClick={onClose}>
        <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <h3>{title}</h3>
            <button onClick={onClose} style={styles.modalClose}>×</button>
          </div>
          <p>{message}</p>
          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            <button type="button" onClick={onConfirm} style={{ ...styles.saveBtn, background: '#dc3545' }}>Confirm</button>
          </div>
        </div>
      </div>
    );
  };

  // ================= SSR GUARD =================
  if (!mounted) return null;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  // ================= MAIN UI =================
  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <button onClick={() => router.push('/vault')} style={styles.backButton}>
                ← Back to Vault
              </button>
              <h1 style={styles.title}>Settings</h1>
            </div>
            <div style={styles.headerRight}>
              <span style={styles.version}>v1.0.0</span>
            </div>
          </div>

          {/* Toast Notification */}
          {toast.show && (
            <div style={{ ...styles.toast, ...(toast.type === 'error' ? styles.toastError : styles.toastSuccess) }}>
              {toast.message}
            </div>
          )}

          {/* Security Dashboard */}
          <div style={styles.dashboard}>
            <h2 style={styles.dashboardTitle}>Security Dashboard</h2>
            <div style={styles.dashboardGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>🔐</div>
                <div style={styles.metricValue}>{entries.length}</div>
                <div style={styles.metricLabel}>Total Entries</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>🛡️</div>
                <div style={styles.metricValue}>{securityScore}%</div>
                <div style={styles.metricLabel}>Security Score</div>
                <div style={styles.progressBar}>
                  <div style={{ ...styles.progressFill, width: `${securityScore}%` }} />
                </div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>💪</div>
                <div style={styles.metricValue}>{strongPasswords}</div>
                <div style={styles.metricLabel}>Strong Passwords</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>⚠️</div>
                <div style={styles.metricValue}>{weakPasswords}</div>
                <div style={styles.metricLabel}>Weak Passwords</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>🔄</div>
                <div style={styles.metricValue}>{reusedPasswords}</div>
                <div style={styles.metricLabel}>Reused Passwords</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricIcon}>☁️</div>
                <div style={styles.metricValue}>{syncCID ? 'Active' : 'Off'}</div>
                <div style={styles.metricLabel}>IPFS Sync</div>
                {syncCID && <div style={styles.cidPreview}>{syncCID.slice(0, 12)}…</div>}
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🔑</span>
              <h3>Security</h3>
            </div>
            <div style={styles.sectionContent}>
              <button onClick={() => setShowPasswordModal(true)} style={styles.primaryButton}>
                Change Master Password
              </button>
              <button onClick={handleLock} style={styles.dangerButton}>
                Lock Vault
              </button>
            </div>
          </div>

          {/* Biometric Section */}
          {biometricAvailable && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIcon}>🔐</span>
                <h3>Biometric Unlock</h3>
              </div>
              <div style={styles.sectionContent}>
                <label style={styles.toggle}>
                  <input type="checkbox" checked={biometricEnabled} onChange={handleBiometricToggle} />
                  <span style={styles.toggleSlider}></span>
                  <span style={styles.toggleLabel}>Use fingerprint / face ID</span>
                </label>
              </div>
            </div>
          )}

          {/* Sync Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🔄</span>
              <h3>Sync</h3>
            </div>
            <div style={styles.sectionContent}>
              <label style={styles.toggle}>
                <input type="checkbox" checked={autoSyncEnabled} onChange={handleAutoSyncToggle} />
                <span style={styles.toggleSlider}></span>
                <span style={styles.toggleLabel}>Auto-sync to IPFS</span>
              </label>
              <div style={styles.buttonGroup}>
                <button onClick={handlePush} disabled={syncLoading} style={styles.secondaryButton}>
                  {syncLoading ? 'Pushing...' : '📤 Push to IPFS'}
                </button>
                <button onClick={handlePull} disabled={syncLoading} style={styles.secondaryButton}>
                  {syncLoading ? 'Pulling...' : '📥 Pull from IPFS'}
                </button>
              </div>
              {syncMessage && <div style={styles.syncMessage}>{syncMessage}</div>}
            </div>
          </div>

          {/* Preferences Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>⚙️</span>
              <h3>Preferences</h3>
            </div>
            <div style={styles.sectionContent}>
              <label style={styles.toggle}>
                <input type="checkbox" checked={darkMode} onChange={handleDarkModeToggle} />
                <span style={styles.toggleSlider}></span>
                <span style={styles.toggleLabel}>Dark Mode</span>
              </label>
              <div style={styles.settingRow}>
                <span>Auto-lock after inactivity</span>
                <select value={autoLock} onChange={handleAutoLockChange} style={styles.select}>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={0}>Never</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>💾</span>
              <h3>Data Management</h3>
            </div>
            <div style={styles.sectionContent}>
              <div style={styles.buttonGroup}>
                <button onClick={() => setShowExportModal(true)} style={styles.secondaryButton}>
                  💾 Export Vault
                </button>
                <label style={styles.fileButton}>
                  📂 Import Vault
                  <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                </label>
              </div>
              {lastBackup && (
                <div style={styles.infoText}>
                  Last backup: {new Date(lastBackup).toLocaleString()}
                </div>
              )}
              <button onClick={() => setShowConfirmModal(true)} style={styles.dangerButtonSmall}>
                🗑️ Clear All Local Data
              </button>
            </div>
          </div>

          {/* Advanced Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader} onClick={() => setShowAdvanced(!showAdvanced)} style={{ cursor: 'pointer' }}>
              <span style={styles.sectionIcon}>🔧</span>
              <h3>Advanced</h3>
              <span style={styles.expandIcon}>{showAdvanced ? '▼' : '▶'}</span>
            </div>
            {showAdvanced && (
              <div style={styles.sectionContent}>
                <div style={styles.infoBox}>
                  <div><strong>Database Size:</strong> {(totalSize / 1024).toFixed(2)} KB</div>
                  <div><strong>Total Entries:</strong> {entries.length}</div>
                  <div><strong>Sync Status:</strong> {syncCID ? 'Active' : 'Not synced'}</div>
                  <div><strong>CID:</strong> <code style={styles.code}>{syncCID || 'None'}</code></div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(syncCID)} style={styles.secondaryButtonSmall}>
                  Copy CID to Clipboard
                </button>
              </div>
            )}
          </div>

          {/* About Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>ℹ️</span>
              <h3>About</h3>
            </div>
            <div style={styles.sectionContent}>
              <p style={styles.aboutText}>AuraSafe Password Manager</p>
              <p style={styles.aboutSubtext}>Secure password management with biometric authentication and IPFS sync</p>
              <div style={styles.links}>
                <a href="#" style={styles.link}>Privacy Policy</a>
                <a href="#" style={styles.link}>Terms of Service</a>
                <a href="#" style={styles.link}>Help & Support</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      <ExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} />
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleClearData}
        title="Clear All Data"
        message="Are you sure you want to clear all local data? This action cannot be undone. Your vault will need to be synced again from IPFS."
      />
    </>
  );
}

// ================= STYLES =================
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a2a0a 0%, #0f3a0f 100%)',
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loadingCard: {
    maxWidth: '400px',
    margin: '0 auto',
    background: 'rgba(20, 40, 20, 0.8)',
    backdropFilter: 'blur(12px)',
    borderRadius: '1.5rem',
    padding: '3rem',
    textAlign: 'center',
    color: '#fff',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.2)',
    borderTopColor: '#4caf50',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 1rem',
  },
  card: {
    maxWidth: '1000px',
    margin: '0 auto',
    background: 'rgba(20, 40, 20, 0.7)',
    backdropFilter: 'blur(12px)',
    borderRadius: '1.5rem',
    padding: '2rem',
    boxShadow: '0 20px 35px -10px rgba(0,0,0,0.5)',
    border: '1px solid rgba(76,175,80,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  version: {
    fontSize: '0.75rem',
    color: '#9CA3AF',
    background: 'rgba(0,0,0,0.3)',
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    background: 'linear-gradient(120deg, #fff, #a5d6a5)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    margin: 0,
  },
  backButton: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(76,175,80,0.5)',
    color: '#fff',
    padding: '0.5rem 1rem',
    borderRadius: '2rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s',
  },
  dashboard: {
    marginBottom: '2rem',
  },
  dashboardTitle: {
    fontSize: '1.2rem',
    color: '#C8E6C9',
    marginBottom: '1rem',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '1rem',
  },
  metricCard: {
    background: 'rgba(30,50,30,0.6)',
    borderRadius: '1rem',
    padding: '1rem',
    textAlign: 'center',
    border: '1px solid rgba(76,175,80,0.3)',
    transition: 'transform 0.2s',
  },
  metricIcon: { fontSize: '1.5rem', marginBottom: '0.5rem' },
  metricValue: { fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' },
  metricLabel: { fontSize: '0.6rem', color: '#c8e6c9', textTransform: 'uppercase' },
  progressBar: { height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#4caf50', borderRadius: '2px', transition: 'width 0.3s' },
  cidPreview: { fontSize: '0.55rem', color: '#a5d6a5', marginTop: '0.25rem', wordBreak: 'break-all' },
  section: {
    marginBottom: '1.5rem',
    padding: '1rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '1rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(76,175,80,0.3)',
  },
  sectionIcon: { fontSize: '1.3rem' },
  sectionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  dangerButton: {
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  dangerButtonSmall: {
    background: 'rgba(220,53,69,0.2)',
    color: '#f87171',
    border: '1px solid #dc3545',
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.75rem',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  secondaryButton: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(76,175,80,0.5)',
    color: '#fff',
    padding: '0.5rem 1rem',
    borderRadius: '2rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'all 0.2s',
  },
  secondaryButtonSmall: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(76,175,80,0.5)',
    color: '#fff',
    padding: '0.3rem 0.8rem',
    borderRadius: '1rem',
    cursor: 'pointer',
    fontSize: '0.7rem',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  fileButton: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(76,175,80,0.5)',
    color: '#fff',
    padding: '0.5rem 1rem',
    borderRadius: '2rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'all 0.2s',
    display: 'inline-block',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    width: 'fit-content',
  },
  toggleSlider: {
    position: 'relative',
    display: 'inline-block',
    width: '44px',
    height: '22px',
    background: '#2c3a2c',
    borderRadius: '34px',
    transition: '0.3s',
  },
  toggleLabel: { fontSize: '0.85rem', color: '#a5d6a5' },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  select: {
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    padding: '0.4rem 0.8rem',
    color: '#fff',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  syncMessage: {
    marginTop: '0.5rem',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    fontSize: '0.7rem',
    background: 'rgba(0,0,0,0.3)',
    color: '#c8e6c9',
  },
  infoText: {
    fontSize: '0.7rem',
    color: '#9CA3AF',
  },
  infoBox: {
    background: 'rgba(0,0,0,0.3)',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.7rem',
    wordBreak: 'break-all',
  },
  expandIcon: {
    marginLeft: 'auto',
    fontSize: '0.7rem',
    color: '#9CA3AF',
  },
  aboutText: { color: '#fff', marginBottom: '0.25rem', fontSize: '0.85rem' },
  aboutSubtext: { color: '#9CA3AF', fontSize: '0.75rem', marginBottom: '0.5rem' },
  links: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    marginTop: '0.5rem',
  },
  link: {
    color: '#60A5FA',
    fontSize: '0.7rem',
    textDecoration: 'none',
  },
  toast: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    zIndex: 1000,
    animation: 'slideIn 0.3s ease',
  },
  toastSuccess: { background: '#10b981', color: '#fff' },
  toastError: { background: '#ef4444', color: '#fff' },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modalContent: {
    background: '#1F2937',
    borderRadius: '1rem',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '420px',
    color: '#fff',
    border: '1px solid rgba(76,175,80,0.3)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  formGroup: { marginBottom: '1rem' },
  formInput: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #374151',
    background: '#111827',
    color: '#fff',
    fontSize: '0.85rem',
  },
  passwordWrapper: { position: 'relative' },
  eyeButton: {
    position: 'absolute',
    right: '0.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  strengthBar: { marginTop: '0.25rem' },
  modalActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  cancelBtn: {
    flex: 1,
    padding: '0.5rem',
    background: '#4B5563',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '0.5rem',
    background: '#2E7D32',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    cursor: 'pointer',
  },
};

// Add animations
if (typeof document !== 'undefined' && !document.getElementById('settings-animations')) {
  const style = document.createElement('style');
  style.id = 'settings-animations';
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    input:checked + .toggle-slider { background: #2e7d32; }
    input:checked + .toggle-slider:before { transform: translateX(22px); }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 2px;
      bottom: 2px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }
    button:hover { transform: translateY(-1px); filter: brightness(1.05); }
    .toggle input { display: none; }
  `;
  document.head.appendChild(style);
}