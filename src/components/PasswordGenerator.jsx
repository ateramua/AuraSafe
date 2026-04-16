// src/components/PasswordGenerator.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import zxcvbn from 'zxcvbn';

const DEFAULT_LENGTH = 16;
const MIN_LENGTH = 6;
const MAX_LENGTH = 128;

const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguous: 'il1Lo0O',
};

// Pronounceable word lists for passphrase generation
const WORD_LISTS = {
  adjectives: ['happy', 'brave', 'calm', 'eager', 'fancy', 'grand', 'jolly', 'kind', 'lively', 'merry', 'nice', 'proud', 'quick', 'smart', 'tidy', 'witty', 'young', 'zesty'],
  nouns: ['bird', 'cloud', 'dragon', 'eagle', 'forest', 'giant', 'heart', 'island', 'jewel', 'king', 'lion', 'moon', 'night', 'ocean', 'phoenix', 'queen', 'river', 'star', 'tree', 'wolf'],
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
};

export default function PasswordGenerator({ isOpen, onClose, onUsePassword }) {
  // State
  const [length, setLength] = useState(DEFAULT_LENGTH);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [strength, setStrength] = useState(null);
  const [copied, setCopied] = useState(false);
  const [passwordHistory, setPasswordHistory] = useState([]);
  const [mode, setMode] = useState('standard'); // 'standard' or 'passphrase'
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalizeWords, setCapitalizeWords] = useState(true);
  const [includeNumber, setIncludeNumber] = useState(true);

  // Get character set based on options
  const getCharacterSet = useCallback(() => {
    let chars = '';
    if (includeUppercase) chars += CHARACTER_SETS.uppercase;
    if (includeLowercase) chars += CHARACTER_SETS.lowercase;
    if (includeNumbers) chars += CHARACTER_SETS.numbers;
    if (includeSymbols) chars += CHARACTER_SETS.symbols;

    if (excludeAmbiguous) {
      CHARACTER_SETS.ambiguous.split('').forEach(char => {
        chars = chars.replace(new RegExp(char, 'g'), '');
      });
    }

    return chars;
  }, [includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous]);

  // Generate random password
  const generateRandomPassword = useCallback(() => {
    const chars = getCharacterSet();
    if (chars.length === 0) {
      setGeneratedPassword('Select at least one character type');
      setStrength(null);
      return;
    }

    let password = '';
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += chars[array[i] % chars.length];
    }

    // Ensure at least one character from each selected set
    let finalPassword = password;
    if (includeUppercase && !/[A-Z]/.test(password)) {
      const pos = Math.floor(Math.random() * password.length);
      const randomUpper = CHARACTER_SETS.uppercase[Math.floor(Math.random() * CHARACTER_SETS.uppercase.length)];
      finalPassword = password.substring(0, pos) + randomUpper + password.substring(pos + 1);
    }

    if (includeLowercase && !/[a-z]/.test(finalPassword)) {
      const pos = Math.floor(Math.random() * finalPassword.length);
      const randomLower = CHARACTER_SETS.lowercase[Math.floor(Math.random() * CHARACTER_SETS.lowercase.length)];
      finalPassword = finalPassword.substring(0, pos) + randomLower + finalPassword.substring(pos + 1);
    }

    if (includeNumbers && !/[0-9]/.test(finalPassword)) {
      const pos = Math.floor(Math.random() * finalPassword.length);
      const randomNum = CHARACTER_SETS.numbers[Math.floor(Math.random() * CHARACTER_SETS.numbers.length)];
      finalPassword = finalPassword.substring(0, pos) + randomNum + finalPassword.substring(pos + 1);
    }

    if (includeSymbols && !/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(finalPassword)) {
      const pos = Math.floor(Math.random() * finalPassword.length);
      const randomSym = CHARACTER_SETS.symbols[Math.floor(Math.random() * CHARACTER_SETS.symbols.length)];
      finalPassword = finalPassword.substring(0, pos) + randomSym + finalPassword.substring(pos + 1);
    }

    setGeneratedPassword(finalPassword);

    // Add to history
    setPasswordHistory(prev => [finalPassword, ...prev.slice(0, 4)]);

    // Evaluate strength
    const result = zxcvbn(finalPassword);
    setStrength(result);
  }, [length, getCharacterSet, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  // Generate passphrase
  const generatePassphrase = useCallback(() => {
    const getRandomWord = (array) => array[Math.floor(Math.random() * array.length)];
    const words = [];

    for (let i = 0; i < wordCount; i++) {
      let word = getRandomWord(WORD_LISTS.adjectives);
      if (i % 2 === 0) {
        word = getRandomWord(WORD_LISTS.nouns);
      }
      if (capitalizeWords && i > 0) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      words.push(word);
    }

    let passphrase = words.join(separator);

    if (includeNumber) {
      const randomNum = Math.floor(Math.random() * 100);
      passphrase += randomNum;
    }

    setGeneratedPassword(passphrase);

    // Add to history
    setPasswordHistory(prev => [passphrase, ...prev.slice(0, 4)]);

    // Evaluate strength
    const result = zxcvbn(passphrase);
    setStrength(result);
  }, [wordCount, separator, capitalizeWords, includeNumber]);

  // Generate based on mode
  const generatePassword = useCallback(() => {
    if (mode === 'standard') {
      generateRandomPassword();
    } else {
      generatePassphrase();
    }
  }, [mode, generateRandomPassword, generatePassphrase]);

  // Auto-generate on setting changes
  useEffect(() => {
    if (isOpen) {
      generatePassword();
    }
  }, [isOpen, generatePassword, length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeAmbiguous, mode, wordCount, separator, capitalizeWords, includeNumber]);

  const handleCopy = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleUse = () => {
    if (generatedPassword) {
      onUsePassword(generatedPassword);
      onClose();
    }
  };

  const handleRegenerate = () => {
    generatePassword();
  };

  const handleHistorySelect = (password) => {
    setGeneratedPassword(password);
    const result = zxcvbn(password);
    setStrength(result);
  };

  // Strength calculations
  const strengthInfo = useMemo(() => {
    if (!strength) return { label: '', color: '', score: 0, timeToCrack: '' };

    const score = strength.score;
    const crackTimes = strength.crack_times_display;
    const timeToCrack = crackTimes?.offline_slow_hashing_1e4_per_second || 'unknown';

    let label = '';
    let color = '';
    if (score === 0) { label = 'Very Weak'; color = '#ef4444'; }
    else if (score === 1) { label = 'Weak'; color = '#f97316'; }
    else if (score === 2) { label = 'Fair'; color = '#eab308'; }
    else if (score === 3) { label = 'Good'; color = '#22c55e'; }
    else if (score === 4) { label = 'Strong'; color = '#10b981'; }

    return { label, color, score, timeToCrack };
  }, [strength]);

  // Entropy calculation
  const entropy = useMemo(() => {
    if (!generatedPassword) return 0;
    const charset = getCharacterSet().length;
    if (charset === 0) return 0;
    return Math.log2(Math.pow(charset, generatedPassword.length)).toFixed(1);
  }, [generatedPassword, getCharacterSet]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>🔐 Password Generator</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.content}>
          {/* Mode Toggle */}
          <div style={styles.modeToggle}>
            <button
              style={{ ...styles.modeButton, ...(mode === 'standard' ? styles.modeActive : {}) }}
              onClick={() => setMode('standard')}
            >
              Standard
            </button>
            <button
              style={{ ...styles.modeButton, ...(mode === 'passphrase' ? styles.modeActive : {}) }}
              onClick={() => setMode('passphrase')}
            >
              Passphrase
            </button>
          </div>

          {mode === 'standard' ? (
            <>
              {/* Length slider */}
              <div style={styles.field}>
                <label style={styles.label}>
                  Password Length: <strong>{length}</strong>
                </label>
                <input
                  type="range"
                  min={MIN_LENGTH}
                  max={MAX_LENGTH}
                  value={length}
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <div style={styles.lengthHint}>Longer = more secure</div>
              </div>

              {/* Character set checkboxes */}
              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={includeUppercase} onChange={(e) => setIncludeUppercase(e.target.checked)} />
                  Uppercase (A-Z)
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={includeLowercase} onChange={(e) => setIncludeLowercase(e.target.checked)} />
                  Lowercase (a-z)
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={includeNumbers} onChange={(e) => setIncludeNumbers(e.target.checked)} />
                  Numbers (2-9)
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={includeSymbols} onChange={(e) => setIncludeSymbols(e.target.checked)} />
                  Symbols (!@#$%^&*)
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={excludeAmbiguous} onChange={(e) => setExcludeAmbiguous(e.target.checked)} />
                  Exclude ambiguous characters
                </label>
              </div>
            </>
          ) : (
            <>
              {/* Passphrase settings */}
              <div style={styles.field}>
                <label style={styles.label}>Number of words: <strong>{wordCount}</strong></label>
                <input
                  type="range"
                  min={3}
                  max={8}
                  value={wordCount}
                  onChange={(e) => setWordCount(parseInt(e.target.value))}
                  style={styles.slider}
                />
              </div>

              <div style={styles.checkboxGroup}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={capitalizeWords} onChange={(e) => setCapitalizeWords(e.target.checked)} />
                  Capitalize words
                </label>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={includeNumber} onChange={(e) => setIncludeNumber(e.target.checked)} />
                  Add random number
                </label>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Separator:</label>
                <select value={separator} onChange={(e) => setSeparator(e.target.value)} style={styles.select}>
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value=".">Dot (.)</option>
                  <option value=" ">Space</option>
                  <option value="">None</option>
                </select>
              </div>
            </>
          )}

          {/* Generated password */}
          <div style={styles.passwordContainer}>
            <input type="text" value={generatedPassword} readOnly style={styles.passwordField} />
            <div style={styles.buttonGroup}>
              <button onClick={handleCopy} style={styles.iconButton} title="Copy">
                {copied ? '✓' : '📋'}
              </button>
              <button onClick={handleRegenerate} style={styles.iconButton} title="Regenerate">
                🔄
              </button>
            </div>
          </div>

          {/* Strength meter & entropy */}
          {strength && (
            <div style={styles.strengthContainer}>
              <div style={styles.strengthBar}>
                <div style={{ width: `${(strengthInfo.score + 1) * 20}%`, height: '100%', background: strengthInfo.color, borderRadius: '3px' }} />
              </div>
              <div style={styles.strengthDetails}>
                <span style={{ color: strengthInfo.color }}>{strengthInfo.label}</span>
                <span style={styles.entropy}>Entropy: {entropy} bits</span>
              </div>
              <div style={styles.timeToCrack}>🔒 Time to crack: {strengthInfo.timeToCrack}</div>
              {strength.feedback?.warning && <div style={styles.feedback}>⚠️ {strength.feedback.warning}</div>}
              {strength.feedback?.suggestions?.length > 0 && (
                <div style={styles.feedback}>💡 {strength.feedback.suggestions[0]}</div>
              )}
            </div>
          )}

          {/* Password History */}
          {passwordHistory.length > 0 && (
            <div style={styles.historyContainer}>
              <div style={styles.historyTitle}>Recently generated:</div>
              <div style={styles.historyList}>
                {passwordHistory.map((pwd, idx) => (
                  <button key={idx} style={styles.historyItem} onClick={() => handleHistorySelect(pwd)}>
                    {pwd.length > 20 ? pwd.substring(0, 20) + '...' : pwd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>Cancel</button>
          <button style={styles.useButton} onClick={handleUse}>Use this password</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  // Change this line in PasswordGenerator.jsx styles
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999, // Change from 2000 to 9999
  },
  modal: {
    background: '#1F2937',
    borderRadius: '1rem',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '550px',
    maxHeight: '90vh',
    overflowY: 'auto',
    color: '#F3F4F6',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #374151', paddingBottom: '0.75rem' },
  title: { margin: 0, fontSize: '1.25rem', fontWeight: 'bold' },
  closeButton: { background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.5rem', cursor: 'pointer', ':hover': { color: '#EF4444' } },
  content: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  modeToggle: { display: 'flex', gap: '0.5rem', background: '#111827', borderRadius: '0.5rem', padding: '0.25rem' },
  modeButton: { flex: 1, padding: '0.5rem', background: 'transparent', border: 'none', borderRadius: '0.375rem', color: '#9CA3AF', cursor: 'pointer', transition: 'all 0.2s' },
  modeActive: { background: '#3B82F6', color: 'white' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { fontSize: '0.875rem', color: '#9CA3AF' },
  lengthHint: { fontSize: '0.7rem', color: '#6B7280' },
  slider: { width: '100%', cursor: 'pointer' },
  select: { padding: '0.5rem', background: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', color: '#F3F4F6' },
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#D1D5DB' },
  passwordContainer: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  passwordField: { flex: 1, padding: '0.75rem', background: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', color: '#F3F4F6', fontFamily: 'monospace', fontSize: '0.875rem' },
  buttonGroup: { display: 'flex', gap: '0.5rem' },
  iconButton: { background: '#374151', border: 'none', borderRadius: '0.5rem', padding: '0.5rem', fontSize: '1rem', cursor: 'pointer', color: '#F3F4F6', ':hover': { background: '#4B5563' } },
  strengthContainer: { marginTop: '0.5rem' },
  strengthBar: { height: '6px', background: '#2D3748', borderRadius: '3px', overflow: 'hidden', marginBottom: '0.5rem' },
  strengthDetails: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' },
  entropy: { fontSize: '0.7rem', color: '#6B7280' },
  timeToCrack: { fontSize: '0.7rem', color: '#9CA3AF', marginBottom: '0.25rem' },
  feedback: { fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem' },
  historyContainer: { marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #374151' },
  historyTitle: { fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '0.5rem' },
  historyList: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  historyItem: { background: '#111827', border: '1px solid #374151', borderRadius: '0.375rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#D1D5DB', cursor: 'pointer', ':hover': { background: '#374151' } },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #374151' },
  cancelButton: { background: '#4B5563', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' },
  useButton: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', transition: 'all 0.2s', ':hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' } },
};