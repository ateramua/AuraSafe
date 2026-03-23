// src/pages/security.jsx
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SecurityDashboard from '../components/SecurityDashboard';
import { isUnlocked } from '../lib/api-client';
import { loadVault } from '../lib/store';

export default function SecurityPage() {
    const [entries, setEntries] = useState([]);
    const [unlocked, setUnlocked] = useState(false);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const checkAndLoad = async () => {
            // Check if running in Electron
            if (typeof window !== 'undefined' && window.api) {
                const unlockedStatus = await isUnlocked();
                setUnlocked(unlockedStatus);
                if (unlockedStatus) {
                    const vaultData = await loadVault();
                    setEntries(vaultData);
                }
            } else {
                // Running in browser dev mode – treat as unlocked and use mock data
                setUnlocked(true);
                const vaultData = await loadVault(); // this will return mock data from api-client
                setEntries(vaultData);
            }
            setLoading(false);
        };
        checkAndLoad();
    }, []);

    if (loading) return <div className="loading-spinner">Loading...</div>;

    if (!unlocked) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <div className="settings-nav">
                        <Link href="/vault">
                            <button className="back-button">← Back to Vault</button>
                        </Link>
                    </div>
                    <h2>Vault Locked</h2>
                    <p>Please unlock your vault to view security insights.</p>
                    <Link href="/vault">
                        <button>Go to Vault</button>
                    </Link>

                </div>
            </div>
        );
    }

    return <SecurityDashboard entries={entries} />;
}