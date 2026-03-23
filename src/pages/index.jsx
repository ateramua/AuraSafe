import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');

  const testElectron = async () => {
    if (window.api?.ping) {
      const response = await window.api.ping();
      setMessage(`Electron replied: ${response}`);
    } else {
      setMessage('Electron API not available');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Password Manager</h1>

      <a href="./vault/">
        <button style={{ marginRight: '1rem' }}>Go to Vault</button>
      </a>

      <a href="./settings/">
        <button style={{
          margin: '1rem',
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}>
          ⚙️ Settings
        </button>
      </a>

      <button onClick={testElectron}>
        Test Electron Connection
      </button>

      <p>{message}</p>
    </div>
  );
}