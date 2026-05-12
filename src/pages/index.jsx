import { useRouter } from 'next/router';
import { useState } from 'react';
import { Button, Card } from '../components/ui';

export default function LandingPage() {
  const router = useRouter();
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const testElectronConnection = async () => {
    setLoading(true);
    setConnectionStatus(null);

    try {
      if (window.api?.ping) {
        const response = await window.api.ping();
        setConnectionStatus({ success: true, message: `Connected! Response: ${response}` });
      } else {
        setConnectionStatus({
          success: false,
          message: 'Electron API not available. Are you running inside the AuraSafe desktop app?',
        });
      }
    } catch (err) {
      setConnectionStatus({ success: false, message: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <Card className="hero-card">
        <div className="hero-copy">
          <h1 className="hero-headline">🔒 AuraSafe</h1>
          <p className="hero-subtitle">Modern desktop security for your vault, backups, and sync settings.</p>
        </div>

        <div className="button-grid">
          <Button variant="primary" onClick={() => router.push('/vault')}>
            Go to Vault
          </Button>
          <Button variant="secondary" onClick={() => router.push('/security')}>
            Go to Security
          </Button>
          <Button variant="secondary" onClick={() => router.push('/settings')}>
            Go to Settings
          </Button>
          <Button variant="ghost" onClick={testElectronConnection} disabled={loading}>
            {loading ? 'Testing...' : 'Test Electron Connection'}
          </Button>
        </div>

        {connectionStatus && (
          <div className={`toast ${connectionStatus.success ? 'success' : 'error'}`}>
            {connectionStatus.message}
          </div>
        )}
      </Card>
    </div>
  );
}
