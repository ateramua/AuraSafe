// src/components/EntryCard.jsx
import { useState } from 'react';

export default function EntryCard({ entry, onEdit, onDelete }) {
  const [showFullCard, setShowFullCard] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const copyToClipboard = async (text, fieldName) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const maskCardNumber = (cardNumber) => {
    if (!cardNumber) return '';
    const last4 = cardNumber.slice(-4);
    return '•••• •••• •••• ' + last4;
  };

  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return '';
    const last4 = accountNumber.slice(-4);
    return '••••' + last4;
  };

  const maskLicenseNumber = (licenseNumber) => {
    if (!licenseNumber) return '';
    if (licenseNumber.length <= 4) return '••••';
    return '••••' + licenseNumber.slice(-4);
  };

  const getCategoryIcon = () => {
    switch (entry.category) {
      case 'creditCard':
        return '💳';
      case 'bankAccount':
        return '🏦';
      case 'driverLicense':
        return '🪪';
      case 'contact':
        return '📍';
      case 'passkey':
        return '🔐';
      case 'credential':
      default:
        return '🔑';
    }
  };

  const getCategoryTitle = () => {
    switch (entry.category) {
      case 'creditCard':
        return 'Payment Card';
      case 'bankAccount':
        return 'Bank Account';
      case 'driverLicense':
        return "Driver's License";
      case 'contact':
        return 'Address';
      case 'passkey':
        return 'Passkey';
      case 'credential':
      default:
        return 'Credential';
    }
  };

  // Render fields based on entry type
  const renderFields = () => {
    switch (entry.category) {
      case 'creditCard':
        return (
          <>
            {entry.cardNumber && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.cardNumber, 'card')}>
                <span style={styles.fieldLabel}>💳 Card:</span>
                <span style={styles.fieldValue}>{maskCardNumber(entry.cardNumber)}</span>
                {copiedField === 'card' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.expiry && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>📅 Expires:</span>
                <span style={styles.fieldValue}>{entry.expiry}</span>
              </div>
            )}
            {entry.cvv && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.cvv, 'cvv')}>
                <span style={styles.fieldLabel}>🔒 CVV:</span>
                <span style={styles.fieldValue}>•••</span>
                {copiedField === 'cvv' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
          </>
        );

      case 'bankAccount':
        return (
          <>
            {entry.bankName && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🏦 Bank:</span>
                <span style={styles.fieldValue}>{entry.bankName}</span>
              </div>
            )}
            {entry.accountNumber && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.accountNumber, 'account')}>
                <span style={styles.fieldLabel}>🔢 Account:</span>
                <span style={styles.fieldValue}>{maskAccountNumber(entry.accountNumber)}</span>
                {copiedField === 'account' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.routingNumber && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.routingNumber, 'routing')}>
                <span style={styles.fieldLabel}>🔄 Routing:</span>
                <span style={styles.fieldValue}>••••{entry.routingNumber.slice(-4)}</span>
                {copiedField === 'routing' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
          </>
        );

      case 'driverLicense':
        return (
          <>
            {entry.licenseNumber && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.licenseNumber, 'license')}>
                <span style={styles.fieldLabel}>📄 License:</span>
                <span style={styles.fieldValue}>{maskLicenseNumber(entry.licenseNumber)}</span>
                {copiedField === 'license' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.state && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>📍 State:</span>
                <span style={styles.fieldValue}>{entry.state}</span>
              </div>
            )}
            {entry.dob && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🎂 DOB:</span>
                <span style={styles.fieldValue}>{entry.dob}</span>
              </div>
            )}
            {entry.expiry && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>📅 Expires:</span>
                <span style={styles.fieldValue}>{entry.expiry}</span>
              </div>
            )}
          </>
        );

      case 'contact':
        return (
          <>
            {entry.addressLine && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.addressLine, 'address')}>
                <span style={styles.fieldLabel}>🏠 Address:</span>
                <span style={styles.fieldValue}>{entry.addressLine}</span>
                {copiedField === 'address' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {(entry.city || entry.state || entry.zip) && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>📍 City/State:</span>
                <span style={styles.fieldValue}>
                  {[entry.city, entry.state, entry.zip].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {entry.country && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🌍 Country:</span>
                <span style={styles.fieldValue}>{entry.country}</span>
              </div>
            )}
          </>
        );

      case 'passkey':
        return (
          <>
            {entry.username && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.username, 'username')}>
                <span style={styles.fieldLabel}>👤 Username:</span>
                <span style={styles.fieldValue}>{entry.username}</span>
                {copiedField === 'username' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.url && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🔗 URL:</span>
                <span style={styles.fieldValue}>
                  <a href={entry.url.startsWith('http') ? entry.url : 'https://' + entry.url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     style={styles.link}>
                    {entry.url.length > 30 ? entry.url.substring(0, 30) + '...' : entry.url}
                  </a>
                </span>
              </div>
            )}
            {entry.passkeyId && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.passkeyId, 'passkeyId')}>
                <span style={styles.fieldLabel}>🔑 Passkey ID:</span>
                <span style={styles.fieldValue}>••••{entry.passkeyId.slice(-8)}</span>
                {copiedField === 'passkeyId' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
          </>
        );

      case 'credential':
      default:
        return (
          <>
            {entry.username && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.username, 'username')}>
                <span style={styles.fieldLabel}>👤 Username:</span>
                <span style={styles.fieldValue}>{entry.username}</span>
                {copiedField === 'username' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.password && (
              <div style={styles.field} onClick={() => copyToClipboard(entry.password, 'password')}>
                <span style={styles.fieldLabel}>🔒 Password:</span>
                <span style={styles.fieldValue}>••••••••</span>
                {copiedField === 'password' && <span style={styles.copied}> ✓</span>}
              </div>
            )}
            {entry.url && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🔗 URL:</span>
                <span style={styles.fieldValue}>
                  <a href={entry.url.startsWith('http') ? entry.url : 'https://' + entry.url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     style={styles.link}>
                    {entry.url.length > 30 ? entry.url.substring(0, 30) + '...' : entry.url}
                  </a>
                </span>
              </div>
            )}
            {entry.totpSecret && (
              <div style={styles.field}>
                <span style={styles.fieldLabel}>🔐 2FA:</span>
                <span style={styles.fieldValue}>Available</span>
              </div>
            )}
          </>
        );
    }
  };

  // Render notes if present
  const renderNotes = () => {
    if (!entry.notes) return null;
    
    return (
      <div style={styles.notes}>
        <span style={styles.fieldLabel}>📝 Notes:</span>
        <span style={styles.notesValue}>
          {showFullCard ? entry.notes : entry.notes.length > 50 ? entry.notes.substring(0, 50) + '...' : entry.notes}
        </span>
        {entry.notes.length > 50 && (
          <button onClick={() => setShowFullCard(!showFullCard)} style={styles.expandBtn}>
            {showFullCard ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={styles.card}>
      <div onClick={() => onEdit(entry)} style={styles.content}>
        <div style={styles.header}>
          <span style={styles.icon}>{getCategoryIcon()}</span>
          <span style={styles.title}>{entry.title || 'Untitled'}</span>
          <span style={styles.badge}>{getCategoryTitle()}</span>
        </div>
        
        <div style={styles.fields}>
          {renderFields()}
        </div>
        
        {renderNotes()}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
        style={styles.delete}
        title="Delete entry"
      >
        🗑️
      </button>
    </div>
  );
}

const styles = {
  card: {
    background: '#1a4a1f',
    padding: '1rem',
    borderRadius: '10px',
    color: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '8px',
    transition: 'all 0.2s ease',
    border: '1px solid rgba(76, 175, 80, 0.2)',
  },
  content: {
    flex: 1,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  icon: {
    fontSize: '1.2rem',
  },
  title: {
    fontWeight: 600,
    fontSize: '1rem',
  },
  badge: {
    background: 'rgba(76, 175, 80, 0.3)',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    color: '#a5d6a5',
  },
  fields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.75rem',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'background 0.2s ease',
  },
  fieldLabel: {
    color: '#9CA3AF',
    minWidth: '70px',
  },
  fieldValue: {
    color: '#F3F4F6',
    wordBreak: 'break-word',
  },
  copied: {
    color: '#10B981',
    fontSize: '0.7rem',
    fontWeight: 'bold',
  },
  link: {
    color: '#60A5FA',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  notes: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '0.7rem',
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  notesValue: {
    color: '#9CA3AF',
    flex: 1,
    wordBreak: 'break-word',
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    color: '#60A5FA',
    cursor: 'pointer',
    fontSize: '0.65rem',
    padding: '0',
    textDecoration: 'underline',
  },
  delete: {
    background: 'rgba(107, 114, 128, 0.2)',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
  },
};