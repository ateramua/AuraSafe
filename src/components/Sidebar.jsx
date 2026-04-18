// src/components/Sidebar.jsx
import { useRouter } from 'next/router';

const categories = [
  { id: 'all', label: 'All Items', icon: '📁' },
  { id: 'passwords', label: 'Passwords', icon: '🔑' },
  { id: 'passkeys', label: 'Passkeys', icon: '🔐' },  // NEW
  { id: 'addresses', label: 'Addresses', icon: '📍' },
  { id: 'paymentCards', label: 'Payment Cards', icon: '💳' },
  { id: 'bankAccounts', label: 'Bank Accounts', icon: '🏦' },
  { id: 'driverLicenses', label: "Driver's Licenses", icon: '🪪' },
  { id: 'help', label: 'Help', icon: '❓' },
];

export default function Sidebar({ onOpenCategory }) {
  const router = useRouter();

  const handleCategoryClick = (categoryId) => {
    if (onOpenCategory) onOpenCategory(categoryId);
  };

  const handleLogout = async () => {
    if (window.api && typeof window.api.lockVault === 'function') {
      try {
        await window.api.lockVault();
        router.reload();
      } catch (err) {
        console.error('Logout failed:', err);
      }
    } else {
      console.warn('window.api or lockVault not available');
    }
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>
        <div style={styles.logo}>🔒 AuraSafe</div>
        <div style={styles.version}>v0.1.0</div>
      </div>

      <nav style={styles.nav}>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={styles.navItem}
            onClick={() => handleCategoryClick(cat.id)}
          >
            <span style={styles.navIcon}>{cat.icon}</span>
            <span style={styles.navLabel}>{cat.label}</span>
            {cat.id === 'help' && <span style={styles.helpBadge}>?</span>}
            {cat.id === 'passkey' && <span style={styles.passkeyBadge}>NEW</span>}
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.footerItem} onClick={() => router.push('/settings')}>
          <span style={styles.footerIcon}>⚙️</span>
          <span>Settings</span>
        </div>
        <div style={styles.footerItem} onClick={handleLogout}>
          <span style={styles.footerIcon}>🚪</span>
          <span style={{ color: '#ff6b6b' }}>Logout</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '280px',
    backgroundColor: '#0a5c2e',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(76, 175, 80, 0.3)',
    height: '100vh',
    zIndex: 1000,
  },
  header: {
    padding: '28px 20px',
    borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
    marginBottom: '20px',
  },
  logo: {
    fontSize: '1.6rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #fff, #a5d6a5)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    marginBottom: '4px',
  },
  version: {
    fontSize: '0.7rem',
    color: '#c8e6c9',
    letterSpacing: '0.5px',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '0 12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: 'transparent',
    color: '#e8f5e9',
    marginBottom: '2px',
    ':hover': {
      background: 'rgba(76, 175, 80, 0.2)',
    },
  },
  navIcon: {
    fontSize: '1.3rem',
    marginRight: '14px',
    width: '28px',
    textAlign: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  helpBadge: {
    background: '#2e7d32',
    borderRadius: '20px',
    padding: '2px 8px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#fff',
  },
  passkeyBadge: {
    background: '#3B82F6',
    borderRadius: '20px',
    padding: '2px 8px',
    fontSize: '0.6rem',
    fontWeight: 'bold',
    color: '#fff',
  },
  footer: {
    padding: '24px 20px',
    borderTop: '1px solid rgba(76, 175, 80, 0.3)',
    marginTop: 'auto',
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    cursor: 'pointer',
    color: '#c8e6c9',
    transition: 'color 0.2s',
  },
  footerIcon: {
    fontSize: '1.2rem',
    marginRight: '14px',
    width: '28px',
    textAlign: 'center',
  },
};