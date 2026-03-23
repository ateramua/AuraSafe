// src/components/PasswordGenerator.jsx
import { useState, useEffect } from 'react';

export default function PasswordGenerator({ onSelect, onClose }) {
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState({ score: 0, label: 'Weak' });

  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+=-{}[];:,.<>?';

  const generatePassword = () => {
    let chars = '';
    if (includeUppercase) chars += uppercase;
    if (includeLowercase) chars += lowercase;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;
    if (chars === '') return;

    let result = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    setPassword(result);
    analyzeStrength(result);
  };

  const analyzeStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 12) score++;
    if (pwd.length >= 16) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    let label = '';
    if (score <= 2) label = 'Weak';
    else if (score <= 4) label = 'Fair';
    else if (score <= 5) label = 'Strong';
    else label = 'Very Strong';
    setStrength({ score, label });
  };

  useEffect(() => {
    generatePassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  const handleUse = () => {
    onSelect(password);
    onClose();
  };

  const getStrengthColor = (score) => {
    if (score <= 2) return '#e53e3e';
    if (score <= 4) return '#ed8936';
    if (score <= 5) return '#48bb78';
    return '#38a169';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal password-generator-modal" onClick={e => e.stopPropagation()}>
        <h2>Generate Strong Password</h2>

        <div className="generator-preview">
          <input type="text" value={password} readOnly className="generated-password" />
          <button onClick={generatePassword} className="refresh-btn">⟳</button>
        </div>

        <div className="strength-meter">
          <div className="strength-bar" style={{ width: `${(strength.score / 6) * 100}%`, background: getStrengthColor(strength.score) }} />
          <span className="strength-label">{strength.label}</span>
        </div>

        <div className="generator-options">
          <label>
            Length: {length}
            <input type="range" min="8" max="32" value={length} onChange={e => setLength(parseInt(e.target.value))} />
          </label>
          <label>
            <input type="checkbox" checked={includeUppercase} onChange={e => setIncludeUppercase(e.target.checked)} />
            Uppercase
          </label>
          <label>
            <input type="checkbox" checked={includeLowercase} onChange={e => setIncludeLowercase(e.target.checked)} />
            Lowercase
          </label>
          <label>
            <input type="checkbox" checked={includeNumbers} onChange={e => setIncludeNumbers(e.target.checked)} />
            Numbers
          </label>
          <label>
            <input type="checkbox" checked={includeSymbols} onChange={e => setIncludeSymbols(e.target.checked)} />
            Symbols
          </label>
        </div>

        <div className="form-buttons">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" onClick={handleUse}>Use this password</button>
        </div>
      </div>
    </div>
  );
}