// src/components/RestoreScreen.jsx
import { useState } from 'react';

export default function RestoreScreen({ onRestoreComplete, onSkip }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFileRestore = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        
        try {
            // Initialize temp backup manager
            await window.api.backupPreVault.initTemp();
            
            // Import the backup file
            const result = await window.api.backupPreVault.importFile();
            
            if (result.success && result.backupData) {
                // Store backup data temporarily
                sessionStorage.setItem('pendingRestore', JSON.stringify(result.backupData));
                setSuccess('Backup file loaded successfully! Redirecting...');
                
                setTimeout(() => {
                    if (onRestoreComplete) onRestoreComplete(result.backupData);
                }, 1500);
            } else if (result.cancelled) {
                // User cancelled, do nothing
                setLoading(false);
            } else {
                setError(result.error || 'Failed to load backup file');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleICloudRestore = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        
        try {
            // Initialize temp backup manager
            await window.api.backupPreVault.initTemp();
            
            // Restore from iCloud
            const result = await window.api.backupPreVault.iCloudRestore();
            
            if (result.success && result.backupData) {
                sessionStorage.setItem('pendingRestore', JSON.stringify(result.backupData));
                setSuccess(`Backup from ${new Date(result.backupDate).toLocaleString()} loaded successfully! Redirecting...`);
                
                setTimeout(() => {
                    if (onRestoreComplete) onRestoreComplete(result.backupData);
                }, 1500);
            } else {
                setError(result.error || 'No iCloud backup found');
            }
        } catch (err) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.icon}>🔒</div>
                <h1 style={styles.title}>Welcome to AuraSafe</h1>
                <p style={styles.subtitle}>Secure password manager</p>
                
                <div style={styles.divider} />
                
                <h3 style={styles.sectionTitle}>Restore Existing Vault</h3>
                <p style={styles.description}>
                    Have a backup? Restore your vault to get all your passwords back.
                </p>
                
                <div style={styles.buttonGroup}>
                    <button 
                        onClick={handleFileRestore} 
                        disabled={loading}
                        style={styles.primaryButton}
                    >
                        📂 Restore from File
                    </button>
                    <button 
                        onClick={handleICloudRestore} 
                        disabled={loading}
                        style={styles.secondaryButton}
                    >
                        ☁️ Restore from iCloud
                    </button>
                </div>
                
                {loading && <div style={styles.loading}>Loading backup...</div>}
                {error && <div style={styles.error}>❌ {error}</div>}
                {success && <div style={styles.success}>✅ {success}</div>}
                
                <div style={styles.dividerLight} />
                
                <div style={styles.skipSection}>
                    <p style={styles.skipText}>Don't have a backup?</p>
                    <button onClick={onSkip} style={styles.skipButton}>
                        Create New Vault →
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a2a0a 0%, #0f3a0f 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    card: {
        maxWidth: '500px',
        width: '100%',
        background: 'rgba(20, 40, 20, 0.8)',
        backdropFilter: 'blur(12px)',
        borderRadius: '2rem',
        padding: '2.5rem',
        textAlign: 'center',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(76, 175, 80, 0.3)',
    },
    icon: {
        fontSize: '4rem',
        marginBottom: '1rem',
    },
    title: {
        fontSize: '2rem',
        fontWeight: 700,
        background: 'linear-gradient(120deg, #fff, #a5d6a5)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        marginBottom: '0.5rem',
    },
    subtitle: {
        color: '#c8e6c9',
        marginBottom: '1.5rem',
    },
    divider: {
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.4), transparent)',
        margin: '1.5rem 0',
    },
    dividerLight: {
        height: '1px',
        background: 'rgba(76, 175, 80, 0.2)',
        margin: '1.5rem 0 1rem 0',
    },
    sectionTitle: {
        fontSize: '1.2rem',
        fontWeight: 600,
        color: '#eef5ff',
        marginBottom: '0.5rem',
    },
    description: {
        color: '#c8e6c9',
        fontSize: '0.9rem',
        marginBottom: '1.5rem',
        lineHeight: '1.5',
    },
    buttonGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem',
    },
    primaryButton: {
        padding: '0.8rem 1.5rem',
        background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
        color: '#fff',
        border: 'none',
        borderRadius: '2rem',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    secondaryButton: {
        padding: '0.8rem 1.5rem',
        background: 'rgba(59, 130, 246, 0.8)',
        color: '#fff',
        border: 'none',
        borderRadius: '2rem',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    },
    loading: {
        marginTop: '1rem',
        padding: '0.5rem',
        color: '#a5d6a5',
        fontSize: '0.9rem',
    },
    error: {
        marginTop: '1rem',
        padding: '0.5rem',
        background: 'rgba(239, 68, 68, 0.2)',
        borderRadius: '0.5rem',
        color: '#f87171',
        fontSize: '0.9rem',
    },
    success: {
        marginTop: '1rem',
        padding: '0.5rem',
        background: 'rgba(76, 175, 80, 0.2)',
        borderRadius: '0.5rem',
        color: '#a5d6a5',
        fontSize: '0.9rem',
    },
    skipSection: {
        marginTop: '0.5rem',
    },
    skipText: {
        color: '#9ca3af',
        fontSize: '0.85rem',
        marginBottom: '0.5rem',
    },
    skipButton: {
        background: 'transparent',
        border: '1px solid #4caf50',
        color: '#4caf50',
        padding: '0.5rem 1rem',
        borderRadius: '2rem',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'all 0.2s ease',
    },
};