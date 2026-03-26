// src/pages/index.js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const testElectronConnection = async () => {
    setLoading(true);
    setConnectionStatus(null);
    try {
      // Check if the Electron API is available
      if (window.api && window.api.ping) {
        const response = await window.api.ping();
        setConnectionStatus({ success: true, message: `Connected! Response: ${response}` });
      } else {
        setConnectionStatus({ success: false, message: 'Electron API not available. Are you running in Electron?' });
      }
    } catch (err) {
      setConnectionStatus({ success: false, message: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.overlay} />
      <div style={styles.content}>
        <div style={styles.card}>
          <h1 style={styles.title}>🔒 AuraSafe</h1>
          <p style={styles.subtitle}>Your secure password manager</p>

          <div style={styles.buttonGrid}>
            <button style={styles.button} onClick={() => router.push('/vault')}>
              Go to Vault
            </button>
            <button style={styles.button} onClick={() => router.push('/security')}>
              Go to Security
            </button>
            <button style={styles.button} onClick={() => router.push('/settings')}>
              Go to Settings
            </button>
            <button
              style={{ ...styles.button, ...styles.testButton }}
              onClick={testElectronConnection}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test Electron Connection'}
            </button>
          </div>

          {connectionStatus && (
            <div style={connectionStatus.success ? styles.successMessage : styles.errorMessage}>
              {connectionStatus.message}
            </div>
          )}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 40%, rgba(100, 200, 100, 0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '600px',
  },
  card: {
    background: 'rgba(20, 40, 20, 0.7)',
    backdropFilter: 'blur(12px)',
    borderRadius: '2rem',
    padding: '2rem 2rem 2.5rem',
    boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(76, 175, 80, 0.3)',
    textAlign: 'center',
    transition: 'transform 0.2s ease',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    background: 'linear-gradient(120deg, #fff, #a5d6a5)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#c8e6c9',
    marginBottom: '2rem',
    opacity: 0.8,
  },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  button: {
    background: 'rgba(40, 167, 69, 0.2)',
    backdropFilter: 'blur(4px)',
    border: '1px solid rgba(76, 175, 80, 0.5)',
    borderRadius: '2rem',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 500,
    color: '#e8f5e9',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    ':hover': {
      background: 'rgba(40, 167, 69, 0.4)',
      transform: 'translateY(-2px)',
      borderColor: '#4caf50',
      boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
    },
  },
  testButton: {
    gridColumn: 'span 2',
    background: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    ':hover': {
      background: 'rgba(59, 130, 246, 0.4)',
      borderColor: '#3b82f6',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    },
  },
  successMessage: {
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: '1rem',
    background: 'rgba(40, 167, 69, 0.2)',
    border: '1px solid #28a745',
    color: '#d4edda',
    fontSize: '0.9rem',
  },
  errorMessage: {
    marginTop: '1rem',
    padding: '0.75rem',
    borderRadius: '1rem',
    background: 'rgba(220, 53, 69, 0.2)',
    border: '1px solid #dc3545',
    color: '#f8d7da',
    fontSize: '0.9rem',
  },
};