// src/pages/index.jsx
import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');

  const navigate = (path) => {
    window.location.href = path;
  };

  const testElectron = async () => {
    if (window.api && window.api.ping) {
      const response = await window.api.ping();
      setMessage(`Electron replied: ${response}`);
    } else {
      setMessage('Electron API not available');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Password Manager</h1>
      <button onClick={() => navigate('/vault')}>Go to Vault</button>
      <button onClick={() => navigate('/security')}>Go to Security</button>
      <button onClick={() => navigate('/settings')}>Go to Settings</button>
      <button onClick={testElectron}>Test Electron Connection</button>
      {message && <p>{message}</p>}
    </div>
  );
}