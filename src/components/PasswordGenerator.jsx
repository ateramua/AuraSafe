// src/components/PasswordGenerator.jsx
import { useState, useEffect } from 'react';
import zxcvbn from 'zxcvbn';

const DEFAULT_LENGTH = 16;
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;
const STORAGE_KEY = 'aurasafe_password_generator_prefs';

const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{}<>?',
};

const DEFAULT_PREFERENCES = {
  length: DEFAULT_LENGTH,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeAmbiguous: true,
  pronounceable: false,
};

const SCORE_LABELS = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
const SCORE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

const getRandomInt = (max) => {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
};

const getCharacterSet = ({ includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous }) => {
  let chars = '';
  if (includeUppercase) chars += CHARACTER_SETS.uppercase;
  if (includeLowercase) chars += CHARACTER_SETS.lowercase;
  if (includeNumbers) chars += CHARACTER_SETS.numbers;
  if (includeSymbols) chars += CHARACTER_SETS.symbols;
  if (excludeAmbiguous) {
    chars = chars.replace(/[Il1O0o]/g, '');
  }
  return chars;
};

const generatePronounceablePassword = ({ length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous }) => {
  const consonants = excludeAmbiguous ? 'bcdfghjkmnpqrstvwxyz' : 'bcdfghjklmnpqrstvwxyz';
  const vowels = 'aeiou';
  const uppercaseMap = includeUppercase ? CHARACTER_SETS.uppercase : '';
  const lowercaseMap = includeLowercase ? CHARACTER_SETS.lowercase : '';
  const letterSet = `${includeLowercase ? lowercaseMap : ''}${includeUppercase ? uppercaseMap : ''}`;

  if (!letterSet.length) {
    return '';
  }

  let password = '';
  let useConsonant = true;

  while (password.length < length) {
    if (useConsonant) {
      const char = consonants[getRandomInt(consonants.length)];
      password += includeUppercase && getRandomInt(100) < 30 ? char.toUpperCase() : char;
    } else {
      const char = vowels[getRandomInt(vowels.length)];
      password += includeUppercase && getRandomInt(100) < 25 ? char.toUpperCase() : char;
    }
    useConsonant = !useConsonant;
  }

  const extraPool = [];
  if (includeNumbers) extraPool.push(...CHARACTER_SETS.numbers.split(''));
  if (includeSymbols) extraPool.push(...CHARACTER_SETS.symbols.split(''));
  if (excludeAmbiguous) {
    for (let i = extraPool.length - 1; i >= 0; i -= 1) {
      if (/[Il1O0o]/.test(extraPool[i])) {
        extraPool.splice(i, 1);
      }
    }
  }

  if (extraPool.length > 0) {
    const generated = password.split('');
    const count = Math.max(1, Math.floor(length / 6));
    for (let i = 0; i < count; i += 1) {
      const position = getRandomInt(generated.length);
      generated[position] = extraPool[getRandomInt(extraPool.length)];
    }
    password = generated.join('');
  }

  return password.slice(0, length);
};

const calculateEntropy = ({ length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous, pronounceable }) => {
  if (pronounceable) {
    const effectiveAlphabet = (includeUppercase || includeLowercase) ? 20 : 1;
    return Math.max(1, length * Math.log2(effectiveAlphabet));
  }

  const charset = getCharacterSet({ includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous });
  return charset.length > 0 ? Math.max(1, length * Math.log2(charset.length)) : 0;
};

const formatCrackTime = (entropyBits) => {
  const guessesPerSecond = 1e9;
  const totalGuesses = Math.pow(2, entropyBits);
  const seconds = totalGuesses / guessesPerSecond;

  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)} days`;
  const years = seconds / 31536000;
  if (years < 100) return `${Math.round(years)} years`;
  return `${years.toFixed(1)} years`;
};

const savePreferences = (prefs) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Failed to save password generator preferences', err);
  }
};

const loadPreferences = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('Failed to load password generator preferences', err);
  }
  return DEFAULT_PREFERENCES;
};

export default function PasswordGenerator({ isOpen, onClose, onUsePassword, zIndex = 1100 }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPreferences(loadPreferences());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    generateNewPassword(preferences);
  }, [isOpen, preferences]);

  const updatePreference = (key, value) => {
    const nextPreferences = { ...preferences, [key]: value };
    setPreferences(nextPreferences);
    savePreferences(nextPreferences);
  };

  const generateNewPassword = (prefs) => {
    const { length, pronounceable, includeUppercase, includeLowercase, includeNumbers, includeSymbols } = prefs;
    const hasLetters = includeUppercase || includeLowercase;
    const charset = getCharacterSet(prefs);

    if (!hasLetters && !includeNumbers && !includeSymbols) {
      setGeneratedPassword('Please select at least one character type');
      setStrength(null);
      return;
    }

    if (prefs.pronounceable && !hasLetters) {
      setGeneratedPassword('Enable uppercase or lowercase for pronounceable passwords');
      setStrength(null);
      return;
    }

    let password = '';
    if (prefs.pronounceable) {
      password = generatePronounceablePassword(prefs);
    } else {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i += 1) {
        password += charset[array[i] % charset.length];
      }
    }

    setGeneratedPassword(password);
    setStrength(zxcvbn(password));
  };

  const handleCopy = async () => {
    if (!generatedPassword) return;

    try {
      await navigator.clipboard.writeText(generatedPassword);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = generatedPassword;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUse = async () => {
    if (!generatedPassword) return;
    if (typeof onUsePassword === 'function') {
      onUsePassword(generatedPassword);
    } else {
      await handleCopy();
    }
    onClose();
  };

  if (!isOpen) return null;

  const entropy = calculateEntropy(preferences);
  const crackTime = formatCrackTime(entropy);
  const score = strength ? strength.score : 0;
  const strengthLabel = SCORE_LABELS[score] || 'Unknown';
  const strengthColor = SCORE_COLORS[score] || '#9CA3AF';

  return (
    <div style={{ ...styles.overlay, zIndex }} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>🔐 Password Generator</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          <div style={styles.field}>
            <label style={styles.label}>Length: {preferences.length}</label>
            <input
              type="range"
              min={MIN_LENGTH}
              max={MAX_LENGTH}
              value={preferences.length}
              onChange={(e) => updatePreference('length', Number(e.target.value))}
              style={styles.slider}
            />
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.includeUppercase}
                onChange={(e) => updatePreference('includeUppercase', e.target.checked)}
              />
              Uppercase (A-Z)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.includeLowercase}
                onChange={(e) => updatePreference('includeLowercase', e.target.checked)}
              />
              Lowercase (a-z)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.includeNumbers}
                onChange={(e) => updatePreference('includeNumbers', e.target.checked)}
              />
              Numbers (2-9)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.includeSymbols}
                onChange={(e) => updatePreference('includeSymbols', e.target.checked)}
              />
              Symbols (!@#$%^&*)
            </label>
          </div>

          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.excludeAmbiguous}
                onChange={(e) => updatePreference('excludeAmbiguous', e.target.checked)}
              />
              Exclude ambiguous characters (Il1O0o)
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={preferences.pronounceable}
                onChange={(e) => updatePreference('pronounceable', e.target.checked)}
              />
              Pronounceable mode
            </label>
          </div>

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
              <button onClick={() => generateNewPassword(preferences)} style={styles.iconButton} title="Regenerate">
                🔄
              </button>
            </div>
          </div>

          <div style={styles.metricsGrid}>
            <div style={styles.metricTile}>
              <div style={styles.metricLabel}>Entropy</div>
              <div style={styles.metricValue}>{Math.round(entropy)} bits</div>
            </div>
            <div style={styles.metricTile}>
              <div style={styles.metricLabel}>Crack Time</div>
              <div style={styles.metricValue}>{crackTime}</div>
            </div>
            <div style={styles.metricTile}>
              <div style={styles.metricLabel}>Strength</div>
              <div style={{ ...styles.metricValue, color: strengthColor }}>{strengthLabel}</div>
            </div>
          </div>

          <div style={styles.strengthContainer}>
            <div style={styles.strengthBar}>
              <div
                style={{
                  width: `${(score + 1) * 20}%`,
                  height: '100%',
                  background: strengthColor,
                  borderRadius: '3px',
                }}
              />
            </div>
            {strength && strength.feedback && strength.feedback.warning && (
              <div style={styles.feedback}>⚠️ {strength.feedback.warning}</div>
            )}
            {strength && strength.feedback && strength.feedback.suggestions && strength.feedback.suggestions.length > 0 && (
              <div style={styles.feedback}>💡 {strength.feedback.suggestions[0]}</div>
            )}
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Close
          </button>
          <button style={styles.useButton} onClick={handleUse}>
            {typeof onUsePassword === 'function' ? 'Use this password' : 'Copy & Close'}
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