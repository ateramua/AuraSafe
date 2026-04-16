// src/components/EntryModal.jsx
import { useState, useEffect } from 'react';
import PasswordGenerator from './PasswordGenerator';

// Map categories to internal type
const categoryToType = {
  passwords: 'credential',
  addresses: 'contact',
  paymentCards: 'creditCard',
  bankAccounts: 'bankAccount',
  driverLicenses: 'driverLicense',
};

// Define fields for each type
const categoryFields = {
  credential: [
    { label: 'Name', name: 'name', type: 'text', required: true },
    { label: 'Username', name: 'username', type: 'text' },
    { label: 'URL', name: 'url', type: 'url', placeholder: 'https://example.com' },
    { label: 'Password', name: 'password', type: 'password' },
  ],
  contact: [
    { label: 'Address Line', name: 'addressLine', type: 'text', required: true },
    { label: 'City', name: 'city', type: 'text' },
    { label: 'State', name: 'state', type: 'text' },
    { label: 'ZIP Code', name: 'zip', type: 'text' },
  ],
  creditCard: [
    { label: 'Cardholder Name', name: 'name', type: 'text', required: true },
    { label: 'Card Number', name: 'cardNumber', type: 'text' },
    { label: 'Expiry Date', name: 'expiry', type: 'text', placeholder: 'MM/YY' },
    { label: 'CVV', name: 'cvv', type: 'password', placeholder: '3-4 digits' },
  ],
  bankAccount: [
    { label: 'Account Holder', name: 'name', type: 'text', required: true },
    { label: 'Bank Name', name: 'bankName', type: 'text' },
    { label: 'Account Type', name: 'accountType', type: 'text', placeholder: 'Checking/Savings' },
    { label: 'Account Number', name: 'accountNumber', type: 'text' },
    { label: 'Routing Number', name: 'routingNumber', type: 'text' },
  ],
  driverLicense: [
    { label: 'Full Name', name: 'name', type: 'text', required: true },
    { label: 'License Number', name: 'licenseNumber', type: 'text' },
    { label: 'State', name: 'state', type: 'text' },
    { label: 'Expiration Date', name: 'expiry', type: 'text', placeholder: 'MM/DD/YYYY' },
    { label: 'Date of Birth', name: 'dob', type: 'text', placeholder: 'MM/DD/YYYY' },
  ],
};

export default function EntryModal({ isOpen, entry, category, onClose, onSave, zIndex = 2000 }) {
  const [formData, setFormData] = useState({});
  const [showGenerator, setShowGenerator] = useState(false);

  // Determine type based on entry (editing) or category (new)
  const type = entry?.type || categoryToType[category] || 'credential';
  const fields = categoryFields[type] || [];

  useEffect(() => {
    if (entry) {
      // Pre-fill editing data
      const initialData = {};
      fields.forEach(f => {
        initialData[f.name] = entry[f.name] || '';
      });
      setFormData(initialData);
    } else {
      // New entry: create empty fields for the category
      const initialData = {};
      fields.forEach(f => (initialData[f.name] = ''));
      setFormData(initialData);
    }
  }, [entry, isOpen, type, fields]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const saveData = entry ? { ...entry, ...formData } : { ...formData, type };
    onSave(saveData);
  };

  const handleUseGeneratedPassword = (password) => {
    setFormData(prev => ({ ...prev, password }));
    setShowGenerator(false);
  };

  if (!isOpen) return null;

  // Helper to check if a field should have a URL preview
  const renderUrlPreview = (value) => {
    if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
      return (
        <div style={styles.urlPreview}>
          <span style={styles.urlPreviewIcon}>🔗</span>
          <a href={value} target="_blank" rel="noopener noreferrer" style={styles.urlPreviewLink}>
            {value.length > 50 ? value.substring(0, 50) + '...' : value}
          </a>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div style={{ ...styles.overlay, zIndex }} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.header}>
            <h2 style={styles.title}>{entry ? 'Edit Entry' : `Add New ${category}`}</h2>
            <button style={styles.closeButton} onClick={onClose}>×</button>
          </div>

          <form style={styles.form} onSubmit={handleSubmit}>
            {fields.map(field => (
              <label key={field.name} style={styles.label}>
                {field.label}:
                {field.name === 'password' ? (
                  <div style={styles.passwordContainer}>
                    <input
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleChange}
                      type={field.type}
                      placeholder={field.placeholder || ''}
                      required={field.required || false}
                      style={styles.passwordInput}
                    />
                    <button
                      type="button"
                      onClick={() => setShowGenerator(true)}
                      style={styles.generateButton}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#2563EB'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#3B82F6'}
                      title="Generate strong password"
                    >
                      🔐 Generate
                    </button>
                  </div>
                ) : field.name === 'url' ? (
                  <div>
                    <input
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleChange}
                      type={field.type}
                      placeholder={field.placeholder || ''}
                      required={field.required || false}
                      style={styles.input}
                    />
                    {renderUrlPreview(formData[field.name])}
                  </div>
                ) : (
                  <input
                    name={field.name}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    type={field.type}
                    placeholder={field.placeholder || ''}
                    required={field.required || false}
                    style={styles.input}
                  />
                )}
              </label>
            ))}

            <div style={styles.actions}>
              <button type="submit" style={styles.saveButton}>
                {entry ? 'Save Changes' : 'Add Entry'}
              </button>
              <button type="button" style={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <PasswordGenerator
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onUsePassword={handleUseGeneratedPassword}
      />
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(8px)',
  },
  modal: {
    background: '#1F2937',
    borderRadius: '1rem',
    padding: '2rem',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    color: '#F3F4F6',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#C8E6C9',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '0.5rem',
    transition: 'background 0.2s',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '0.9rem',
    color: '#C8E6C9',
  },
  input: {
    marginTop: '0.3rem',
    padding: '0.5rem 0.7rem',
    borderRadius: '0.5rem',
    border: '1px solid #4caf50',
    background: '#111827',
    color: '#F3F4F6',
    fontSize: '0.9rem',
  },
  passwordContainer: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.3rem',
  },
  passwordInput: {
    flex: 1,
    padding: '0.5rem 0.7rem',
    borderRadius: '0.5rem',
    border: '1px solid #4caf50',
    background: '#111827',
    color: '#F3F4F6',
    fontSize: '0.9rem',
  },
  generateButton: {
    padding: '0.5rem 1rem',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  urlPreview: {
    marginTop: '0.5rem',
    padding: '0.5rem',
    background: '#111827',
    borderRadius: '0.5rem',
    border: '1px solid #2d4a2d',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
  },
  urlPreviewIcon: {
    fontSize: '1rem',
  },
  urlPreviewLink: {
    color: '#60A5FA',
    textDecoration: 'none',
    wordBreak: 'break-all',
    flex: 1,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  saveButton: {
    padding: '0.6rem 1.5rem',
    background: '#2E7D32',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  cancelButton: {
    padding: '0.6rem 1.5rem',
    background: 'transparent',
    color: '#C8E6C9',
    border: '1px solid #4caf50',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
};

// Add hover styles via style tag
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  button:active {
    transform: translateY(0);
  }
  .generate-button:hover {
    background: #2563EB !important;
  }
  .url-preview-link:hover {
    text-decoration: underline;
  }
`;
document.head.appendChild(styleSheet);