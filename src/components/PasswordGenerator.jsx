// src/components/PasswordGenerator.jsx
import { useState, useEffect } from 'react';
import zxcvbn from 'zxcvbn';

const DEFAULT_LENGTH = 16;
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*',
};

export default function PasswordGenerator({ isOpen, onClose, onUsePassword }) {
  const [length, setLength] = useState(DEFAULT_LENGTH);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [copied, setCopied] = useState(false);

  // Generate password based on current settings
  const generatePassword = () => {
    let chars = '';
    if (includeUppercase) chars += CHARACTER_SETS.uppercase;
    if (includeLowercase) chars += CHARACTER_SETS.lowercase;
    if (includeNumbers) chars += CHARACTER_SETS.numbers;
    if (includeSymbols) chars += CHARACTER_SETS.symbols;

    if (chars.length === 0) {
      setGeneratedPassword('Please select at least one character type');
      setStrength(null);
      return;
    }

    let password = '';
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }
    setGeneratedPassword(password);

    // Evaluate strength
    const result = zxcvbn(password);
    setStrength(result);
  };

  // Regenerate when settings change
  useEffect(() => {
    generatePassword();
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  const handleCopy = () => {
    if (!generatedPassword) return;
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = () => {
    if (generatedPassword) {
      onUsePassword(generatedPassword);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Strength label and color
  let strengthLabel = '';
  let strengthColor = '';
  if (strength) {
    const score = strength.score;
    if (score === 0) { strengthLabel = 'Very Weak'; strengthColor = '#ef4444'; }
    else if (score === 1) { strengthLabel = 'Weak'; strengthColor = '#f97316'; }
    else if (score === 2) { strengthLabel = 'Fair'; strengthColor = '#eab308'; }
    else if (score === 3) { strengthLabel = 'Good'; strengthColor = '#22c55e'; }
    else if (score === 4) { strengthLabel = 'Strong'; strengthColor = '#10b981'; }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>🔐 Password Generator</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          {/* Length slider */}
          <div style={styles.field}>
            <label style={styles.label}>Length: {length}</label>
            <input
              type="range"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              style={styles.slider}
            />
          </div>

          {/* Character set checkboxes */}
          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeUppercase}
                onChange={(e) => setIncludeUppercase(e.target.checked)}
              />
              Uppercase (A-Z)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeLowercase}
                onChange={(e) => setIncludeLowercase(e.target.checked)}
              />
              Lowercase (a-z)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
              />
              Numbers (2-9)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
              />
              Symbols (!@#$%^&*)
            </label>
          </div>

          {/* Generated password */}
          <div style={styles.passwordContainer}>
            <input
              type="text"
              value={generatedPassword}
              readOnly
              style={styles.passwordField}
            />
            <div style={styles.buttonGroup}>
              <button onClick={handleCopy} style={styles.iconButton} title="Copy">
                {copied ? '✓' : '📋'}
              </button>
              <button onClick={generatePassword} style={styles.iconButton} title="Regenerate">
                🔄
              </button>
            </div>
          </div>

          {/* Strength meter */}
          {strength && (
            <div style={styles.strengthContainer}>
              <div style={styles.strengthBar}>
                <div
                  style={{
                    width: `${(strength.score + 1) * 20}%`,
                    height: '100%',
                    background: strengthColor,
                    borderRadius: '3px',
                  }}
                />
              </div>
              <span style={{ color: strengthColor }}>{strengthLabel}</span>
              {strength.feedback && strength.feedback.warning && (
                <div style={styles.feedback}>{strength.feedback.warning}</div>
              )}
              {strength.feedback && strength.feedback.suggestions && (
                <div style={styles.feedback}>💡 {strength.feedback.suggestions[0]}</div>
              )}
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button style={styles.useButton} onClick={handleUse}>
            Use this password
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  modal: {
    background: '#1F2937',
    borderRadius: '1rem',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '500px',
    color: '#F3F4F6',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #374151',
    paddingBottom: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 'bold',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0 0.5rem',
    ':hover': { color: '#EF4444' },
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    color: '#9CA3AF',
  },
  slider: {
    width: '100%',
    cursor: 'pointer',
  },
  checkboxGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#D1D5DB',
  },
  passwordContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  passwordField: {
    flex: 1,
    padding: '0.75rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  iconButton: {
    background: '#374151',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#F3F4F6',
    transition: 'background 0.2s',
    ':hover': { background: '#4B5563' },
  },
  strengthContainer: {
    marginTop: '0.5rem',
  },
  strengthBar: {
    height: '6px',
    background: '#2D3748',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  feedback: {
    fontSize: '0.75rem',
    color: '#9CA3AF',
    marginTop: '0.25rem',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #374151',
  },
  cancelButton: {
    background: '#4B5563',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
    ':hover': { background: '#6B7280' },
  },
  useButton: {
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' },
  },
};