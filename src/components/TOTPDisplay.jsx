// src/components/TOTPDisplay.jsx
import { useState, useEffect } from 'react';
import { generateTOTP, getRemainingSeconds } from '../utils/totp';

export default function TOTPDisplay({ secret, label }) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!secret) return;

    const generateAndUpdate = async () => {
      const newCode = await generateTOTP(secret);
      if (newCode) setCode(newCode);
      setRemaining(getRemainingSeconds());
    };

    generateAndUpdate();
    
    const interval = setInterval(() => {
      const newRemaining = getRemainingSeconds();
      setRemaining(newRemaining);
      
      if (newRemaining === 30) {
        generateAndUpdate();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [secret]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!secret || !code) return null;

  return (
    <div style={styles.container}>
      <div style={styles.label}>{label || 'Authenticator Code'}</div>
      <div style={styles.codeContainer}>
        <span style={styles.code}>{code}</span>
        <button onClick={handleCopy} style={styles.copyBtn} title="Copy code">
          {copied ? '✓' : '📋'}
        </button>
      </div>
      <div style={styles.timerContainer}>
        <div style={{ ...styles.timerBar, width: `${(remaining / 30) * 100}%` }} />
        <span style={styles.timerText}>{remaining}s</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#1a4a1f',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
  },
  label: {
    fontSize: '11px',
    color: '#9CA3AF',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  codeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  code: {
    fontSize: '28px',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#10B981',
    letterSpacing: '4px',
  },
  copyBtn: {
    background: '#3B82F6',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  timerContainer: {
    marginTop: '8px',
    height: '4px',
    background: '#374151',
    borderRadius: '2px',
    overflow: 'hidden',
    position: 'relative',
  },
  timerBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #10B981, #3B82F6)',
    transition: 'width 0.3s linear',
  },
  timerText: {
    position: 'absolute',
    right: '0',
    top: '-16px',
    fontSize: '10px',
    color: '#9CA3AF',
  },
};