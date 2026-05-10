// src/components/BackupSettings.jsx
import { useState, useEffect } from 'react';

export default function BackupSettings({ api, vaultData, onRestoreComplete }) {
    const [iCloudAvailable, setICloudAvailable] = useState(false);
    const [backupStatus, setBackupStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [localBackups, setLocalBackups] = useState([]);

    useEffect(() => {
        checkICloudStatus();
        findLocalBackups();
    }, []);

    const checkICloudStatus = async () => {
        const result = await api.backup.iCloudAvailable();
        setICloudAvailable(result);
    };

    const findLocalBackups = async () => {
        const result = await api.backup.findLocal();
        if (result && result.length > 0) {
            setLocalBackups(result);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        setBackupStatus('Exporting...');
        const result = await api.backup.export(vaultData);
        if (result.success) {
            setBackupStatus(`✓ Backup saved to: ${result.filePath}`);
        } else {
            setBackupStatus(`✗ Failed: ${result.error}`);
        }
        setLoading(false);
        setTimeout(() => setBackupStatus(''), 3000);
    };

    const handleImport = async () => {
        setLoading(true);
        setBackupStatus('Importing...');
        const result = await api.backup.import();
        if (result.success) {
            setBackupStatus(`✓ Restored from backup (${new Date(result.timestamp).toLocaleString()})`);
            if (onRestoreComplete) onRestoreComplete(result.data);
        } else if (!result.cancelled) {
            setBackupStatus(`✗ Failed: ${result.error}`);
        }
        setLoading(false);
        setTimeout(() => setBackupStatus(''), 3000);
    };

    const handleICloudBackup = async () => {
        if (!iCloudAvailable) {
            setBackupStatus('✗ iCloud Drive not available. Please enable in System Settings.');
            setTimeout(() => setBackupStatus(''), 3000);
            return;
        }
        
        setLoading(true);
        setBackupStatus('Backing up to iCloud...');
        const result = await api.backup.iCloudBackup(vaultData);
        if (result.success) {
            setBackupStatus('✓ Backup saved to iCloud Drive');
        } else {
            setBackupStatus(`✗ Failed: ${result.error}`);
        }
        setLoading(false);
        setTimeout(() => setBackupStatus(''), 3000);
    };

    const handleICloudRestore = async () => {
        if (!iCloudAvailable) {
            setBackupStatus('✗ iCloud Drive not available');
            setTimeout(() => setBackupStatus(''), 3000);
            return;
        }
        
        setLoading(true);
        setBackupStatus('Restoring from iCloud...');
        const result = await api.backup.iCloudRestore();
        if (result.success) {
            setBackupStatus(`✓ Restored from iCloud (${result.backupDate})`);
            if (onRestoreComplete) onRestoreComplete(result.data);
        } else {
            setBackupStatus(`✗ Failed: ${result.error}`);
        }
        setLoading(false);
        setTimeout(() => setBackupStatus(''), 3000);
    };

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>🔒 Vault Backup</h3>
            
            <div style={styles.section}>
                <h4>📁 Manual Backup (Layer 3)</h4>
                <div style={styles.buttonGroup}>
                    <button 
                        onClick={handleExport} 
                        disabled={loading}
                        style={styles.button}
                    >
                        💾 Export to File
                    </button>
                    <button 
                        onClick={handleImport} 
                        disabled={loading}
                        style={styles.button}
                    >
                        📂 Import from File
                    </button>
                </div>
                <p style={styles.hint}>
                    Save your vault to a USB drive, Dropbox, or any safe location.
                    You can restore later by importing the .aura file.
                </p>
            </div>

            <div style={styles.section}>
                <h4>☁️ iCloud Backup (Layer 2)</h4>
                <div style={styles.buttonGroup}>
                    <button 
                        onClick={handleICloudBackup} 
                        disabled={loading}
                        style={styles.button}
                    >
                        ☁️ Backup to iCloud
                    </button>
                    <button 
                        onClick={handleICloudRestore} 
                        disabled={loading}
                        style={styles.button}
                    >
                        🔄 Restore from iCloud
                    </button>
                </div>
                {!iCloudAvailable && (
                    <p style={styles.warning}>
                        ⚠️ iCloud Drive not available. Enable iCloud Drive in System Settings &gt; Apple ID &gt; iCloud Drive.
                    </p>
                )}
                {iCloudAvailable && (
                    <p style={styles.hint}>
                        ✓ iCloud Drive is available. Your backups will sync across devices.
                    </p>
                )}
            </div>

            {localBackups.length > 0 && (
                <div style={styles.section}>
                    <h4>📋 Recent Local Backups</h4>
                    <ul style={styles.backupList}>
                        {localBackups.map((backup, idx) => (
                            <li key={idx}>
                                {backup.name} - {new Date(backup.modified).toLocaleString()}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {backupStatus && (
                <div style={styles.status}>{backupStatus}</div>
            )}
        </div>
    );
}

const styles = {
    container: {
        background: '#1F2937',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginTop: '1rem',
    },
    title: {
        fontSize: '1.2rem',
        fontWeight: 600,
        color: '#C8E6C9',
        marginBottom: '1rem',
        borderBottom: '1px solid #374151',
        paddingBottom: '0.5rem',
    },
    section: {
        marginBottom: '1.5rem',
    },
    buttonGroup: {
        display: 'flex',
        gap: '1rem',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
    },
    button: {
        padding: '0.5rem 1rem',
        background: '#2E7D32',
        color: '#fff',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
        ':disabled': {
            opacity: 0.5,
            cursor: 'not-allowed',
        },
    },
    hint: {
        fontSize: '0.75rem',
        color: '#9CA3AF',
        marginTop: '0.25rem',
    },
    warning: {
        fontSize: '0.75rem',
        color: '#F87171',
        marginTop: '0.25rem',
    },
    backupList: {
        marginTop: '0.5rem',
        paddingLeft: '1.5rem',
        color: '#9CA3AF',
        fontSize: '0.8rem',
    },
    status: {
        marginTop: '1rem',
        padding: '0.5rem',
        background: '#111827',
        borderRadius: '0.5rem',
        fontSize: '0.8rem',
        color: '#4caf50',
        textAlign: 'center',
    },
};