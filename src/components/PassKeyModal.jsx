// src/components/PasskeyModal.jsx
import { useState, useEffect } from 'react';

export default function PasskeyModal({ isOpen, onClose, api }) {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passkeyName, setPasskeyName] = useState('');

  // Check if WebAuthn is supported
  const isWebAuthnSupported = () => {
    return window.PublicKeyCredential !== undefined;
  };

  // Load existing passkeys
  const loadPasskeys = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.getPasskeys?.();
      if (result?.success) {
        setPasskeys(result.data || []);
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPasskeys();
      setMessage({ type: '', text: '' });
    }
  }, [isOpen]);

  // Generate random challenge
  const generateChallenge = () => {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    return challenge;
  };

  // Register a new passkey
  const handleRegisterPasskey = async () => {
    if (!passkeyName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name for this passkey' });
      return;
    }

    if (!isWebAuthnSupported()) {
      setMessage({ type: 'error', text: 'WebAuthn is not supported on this device/browser' });
      return;
    }

    setRegistering(true);
    setMessage({ type: '', text: '' });

    try {
      // Get the current user
      const userResult = await api.getCurrentUser?.();
      const userId = userResult?.data?.id || 'user123';
      const userName = userResult?.data?.username || 'AuraSafe User';

      // Create credential options
      const publicKeyCredentialCreationOptions = {
        challenge: generateChallenge(),
        rp: {
          name: 'AuraSafe',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      };

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      });

      if (credential) {
        // Save the credential to the backend
        const passkeyData = {
          id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          name: passkeyName,
          credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          publicKey: btoa(String.fromCharCode(...new Uint8Array(credential.response.getPublicKey()))),
          signCount: credential.response.getAuthenticatorData(),
          transports: credential.response.getTransports?.() || [],
          created_at: Date.now(),
        };

        const result = await api.savePasskey?.(passkeyData);
        if (result?.success) {
          setMessage({ type: 'success', text: 'Passkey registered successfully!' });
          setPasskeyName('');
          await loadPasskeys();
        } else {
          setMessage({ type: 'error', text: result?.error || 'Failed to save passkey' });
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to register passkey' });
    } finally {
      setRegistering(false);
    }
  };

  // Authenticate with passkey
  const handleAuthenticate = async () => {
    if (!isWebAuthnSupported()) {
      setMessage({ type: 'error', text: 'WebAuthn is not supported on this device/browser' });
      return;
    }

    setAuthenticating(true);
    setMessage({ type: '', text: '' });

    try {
      // Get assertion options
      const publicKeyCredentialRequestOptions = {
        challenge: generateChallenge(),
        timeout: 60000,
        rpId: window.location.hostname,
        userVerification: 'preferred',
        allowCredentials: passkeys.map(p => ({
          id: Uint8Array.from(atob(p.credentialId), c => c.charCodeAt(0)),
          type: 'public-key',
          transports: p.transports || ['internal'],
        })),
      };

      // Get assertion
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      });

      if (assertion) {
        setMessage({ type: 'success', text: 'Authentication successful!' });
        // You can trigger a login event here
        if (api.onPasskeyAuthenticated) {
          await api.onPasskeyAuthenticated();
        }
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to authenticate' });
    } finally {
      setAuthenticating(false);
    }
  };

  // Delete a passkey
  const handleDeletePasskey = async (id) => {
    if (!confirm('Are you sure you want to delete this passkey?')) return;

    try {
      const result = await api.deletePasskey?.(id);
      if (result?.success) {
        setMessage({ type: 'success', text: 'Passkey deleted successfully' });
        await loadPasskeys();
      } else {
        setMessage({ type: 'error', text: result?.error || 'Failed to delete passkey' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            <span style={styles.titleIcon}>🔐</span>
            Passkey Manager
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.content}>
          {!isWebAuthnSupported() && (
            <div style={styles.warningBox}>
              ⚠️ WebAuthn is not supported on this browser. Please use a modern browser like Chrome, Edge, or Safari.
            </div>
          )}

          {/* Register New Passkey */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Register New Passkey</h3>
            <div style={styles.registerForm}>
              <input
                type="text"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                placeholder="e.g., My Laptop, Work Computer"
                style={styles.input}
                disabled={registering}
              />
              <button
                onClick={handleRegisterPasskey}
                disabled={registering || !passkeyName.trim() || !isWebAuthnSupported()}
                style={styles.registerBtn}
              >
                {registering ? 'Registering...' : '+ Register Passkey'}
              </button>
            </div>
            <div style={styles.hint}>
              💡 A passkey lets you unlock your vault using your device's biometric sensor (fingerprint, face ID) or PIN.
            </div>
          </div>

          {/* Message Display */}
          {message.text && (
            <div style={{ ...styles.message, ...(message.type === 'error' ? styles.errorMsg : styles.successMsg) }}>
              {message.text}
            </div>
          )}

          {/* Existing Passkeys */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              Your Passkeys
              {passkeys.length > 0 && <span style={styles.countBadge}>{passkeys.length}</span>}
            </h3>

            {loading ? (
              <div style={styles.loading}>Loading passkeys...</div>
            ) : passkeys.length === 0 ? (
              <div style={styles.emptyState}>
                <span style={styles.emptyIcon}>🔐</span>
                <p>No passkeys registered yet</p>
                <p style={styles.emptyHint}>Register a passkey above to enable passwordless login</p>
              </div>
            ) : (
              <div style={styles.passkeyList}>
                {passkeys.map((passkey) => (
                  <div key={passkey.id} style={styles.passkeyItem}>
                    <div style={styles.passkeyInfo}>
                      <span style={styles.passkeyIcon}>🔑</span>
                      <div>
                        <div style={styles.passkeyName}>{passkey.name}</div>
                        <div style={styles.passkeyMeta}>
                          Created: {new Date(passkey.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePasskey(passkey.id)}
                      style={styles.deleteBtn}
                      title="Delete passkey"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Authenticate Button */}
          {passkeys.length > 0 && (
            <div style={styles.section}>
              <button
                onClick={handleAuthenticate}
                disabled={authenticating}
                style={styles.authenticateBtn}
              >
                {authenticating ? 'Authenticating...' : '🔓 Test Passkey Authentication'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
  },
  modal: {
    background: '#0f3d24',
    borderRadius: '20px',
    padding: '28px',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '85vh',
    overflowY: 'auto',
    color: '#fff',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    background: 'linear-gradient(120deg, #fff, #a5d6a5)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  titleIcon: {
    fontSize: '1.8rem',
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#C8E6C9',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  countBadge: {
    background: '#2e7d32',
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
  },
  registerForm: {
    display: 'flex',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#1a4a1f',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none',
  },
  registerBtn: {
    padding: '10px 20px',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  hint: {
    fontSize: '0.7rem',
    color: '#9CA3AF',
    padding: '8px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
  },
  warningBox: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #EF4444',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: '#F87171',
  },
  message: {
    padding: '12px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  successMsg: {
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid #10B981',
    color: '#6EE7B7',
  },
  errorMsg: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #EF4444',
    color: '#F87171',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#9CA3AF',
  },
  emptyState: {
    textAlign: 'center',
    padding: '30px',
    background: '#1a4a1f',
    borderRadius: '12px',
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: '12px',
  },
  emptyHint: {
    fontSize: '0.75rem',
    color: '#6B7280',
    marginTop: '8px',
  },
  passkeyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  passkeyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#1a4a1f',
    borderRadius: '10px',
    transition: 'all 0.2s ease',
  },
  passkeyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  passkeyIcon: {
    fontSize: '1.2rem',
  },
  passkeyName: {
    fontWeight: 500,
    fontSize: '0.9rem',
  },
  passkeyMeta: {
    fontSize: '0.7rem',
    color: '#9CA3AF',
  },
  deleteBtn: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: 'none',
    color: '#F87171',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  authenticateBtn: {
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #10B981, #059669)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
  },
};