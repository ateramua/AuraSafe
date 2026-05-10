// src/components/EntryCard.jsx
export default function EntryCard({ entry, onEdit, onDelete }) {
  // Get icon based on category
  const getIcon = () => {
    switch (entry.category) {
      case 'credential':
        return '🔑';
      case 'passkey':
        return '🔐';
      case 'contact':
        return '📍';
      case 'creditCard':
        return '💳';
      case 'bankAccount':
        return '🏦';
      case 'driverLicense':
        return '🪪';
      default:
        return '📄';
    }
  };

  // Get display fields based on category
  const getDisplayFields = () => {
    switch (entry.category) {
      case 'credential':
        return {
          primary: entry.title || entry.username || 'Untitled',
          secondary: entry.username,
          tertiary: entry.url,
          detail: 'password' in entry ? '••••••••' : null
        };
      
      case 'passkey':
        return {
          primary: entry.title || 'Untitled Passkey',
          secondary: entry.username,
          tertiary: entry.url,
          detail: `Passkey ID: ${entry.passkeyId?.slice(0, 8)}...` || 'Registered'
        };
      
      case 'contact':
        return {
          primary: entry.title || entry.fullName || 'Untitled Address',
          secondary: [entry.addressLine, entry.city, entry.state].filter(Boolean).join(', '),
          tertiary: entry.phone || entry.email,
          detail: entry.country
        };
      
      case 'creditCard':
        return {
          primary: entry.title || 'Untitled Card',
          secondary: entry.cardNumber ? `•••• •••• •••• ${entry.cardNumber.slice(-4)}` : 'No card number',
          tertiary: `Expires: ${entry.expiry || 'N/A'}`,
          detail: `CVV: ${entry.cvv ? '•••' : 'Not set'}`
        };
      
      case 'bankAccount':
        return {
          primary: entry.title || entry.accountHolder || 'Untitled Account',
          secondary: entry.bankName || 'Bank account',
          tertiary: entry.accountNumber ? `••••${entry.accountNumber.slice(-4)}` : 'No account number',
          detail: entry.accountType || 'Checking/Savings'
        };
      
      case 'driverLicense':
        return {
          primary: entry.title || entry.fullName || 'Untitled License',
          secondary: entry.licenseNumber ? `License: ${entry.licenseNumber}` : 'No license number',
          tertiary: entry.state || 'State not specified',
          detail: `Expires: ${entry.expiry || 'N/A'}`
        };
      
      default:
        return {
          primary: entry.title || 'Untitled',
          secondary: entry.username || entry.email || '',
          tertiary: entry.url || '',
          detail: null
        };
    }
  };

  const fields = getDisplayFields();
  const icon = getIcon();

  return (
    <div className="entry-card">
      <div className="entry-card-content" onClick={() => onEdit(entry)}>
        <div className="entry-icon">{icon}</div>
        <div className="entry-details">
          <div className="entry-name">{fields.primary}</div>
          {fields.secondary && (
            <div className="entry-username">{fields.secondary}</div>
          )}
          {fields.tertiary && (
            <div className="entry-url">{fields.tertiary}</div>
          )}
          {fields.detail && (
            <div className="entry-detail">{fields.detail}</div>
          )}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
        className="delete-button"
        title="Delete entry"
      >
        🗑️
      </button>
    </div>
  );
}