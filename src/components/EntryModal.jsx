import { useState, useEffect } from 'react';

const categoryToType = {
  passwords: 'credential',
  addresses: 'contact',
  paymentCards: 'creditCard',
  bankAccounts: 'bankAccount',
  driverLicenses: 'driverLicense',
};

const categoryLabels = {
  passwords: 'Password Entry',
  addresses: 'Contact Entry',
  paymentCards: 'Payment Card Entry',
  bankAccounts: 'Bank Account Entry',
  driverLicenses: "Driver's License Entry",
};

const defaultFields = {
  title: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  fullName: '',
  addressLine: '',
  city: '',
  state: '',
  zip: '',
  country: '',
  phone: '',
  email: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
  bankName: '',
  accountHolder: '',
  accountNumber: '',
  routingNumber: '',
  licenseNumber: '',
};

const getInitialState = (entry) => ({
  ...defaultFields,
  ...entry,
});

const getFieldConfig = (category) => {
  switch (category) {
    case 'passwords':
      return [
        { name: 'title', label: 'Title' },
        { name: 'username', label: 'Username' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'url', label: 'Website' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
    case 'addresses':
      return [
        { name: 'title', label: 'Title' },
        { name: 'fullName', label: 'Name' },
        { name: 'addressLine', label: 'Address' },
        { name: 'city', label: 'City' },
        { name: 'state', label: 'State' },
        { name: 'zip', label: 'ZIP' },
        { name: 'country', label: 'Country' },
        { name: 'phone', label: 'Phone' },
        { name: 'email', label: 'Email' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
    case 'paymentCards':
      return [
        { name: 'title', label: 'Card Name' },
        { name: 'cardNumber', label: 'Card Number' },
        { name: 'expiry', label: 'Expiry Date' },
        { name: 'cvv', label: 'CVV' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
    case 'bankAccounts':
      return [
        { name: 'title', label: 'Account Name' },
        { name: 'bankName', label: 'Bank Name' },
        { name: 'accountHolder', label: 'Account Holder' },
        { name: 'accountNumber', label: 'Account Number' },
        { name: 'routingNumber', label: 'Routing Number' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
    case 'driverLicenses':
      return [
        { name: 'title', label: 'License Name' },
        { name: 'fullName', label: 'Name' },
        { name: 'licenseNumber', label: 'License Number' },
        { name: 'state', label: 'State' },
        { name: 'expiry', label: 'Expiry Date' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
    default:
      return [
        { name: 'title', label: 'Title' },
        { name: 'notes', label: 'Notes', multiline: true },
      ];
  }
};

export default function EntryModal({ isOpen, entry, category, onClose, onSave, zIndex = 1200 }) {
  const [form, setForm] = useState(getInitialState(entry || {}));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(getInitialState(entry || {}));
    }
  }, [isOpen, entry]);

  if (!isOpen) return null;

  const categoryLabel = categoryLabels[category] || 'Vault Entry';
  const fields = getFieldConfig(category);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...entry,
        ...form,
        type: categoryToType[category] || entry?.type || 'credential',
        id: entry?.id || Date.now().toString(),
      };
      await onSave(payload);
    } catch (err) {
      console.error('Failed to save entry:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...styles.overlay, zIndex }} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{entry ? `Edit ${categoryLabel}` : `New ${categoryLabel}`}</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div style={styles.content}>
          {fields.map((field) => (
            <div key={field.name} style={styles.fieldRow}>
              <label style={styles.label}>{field.label}</label>
              {field.multiline ? (
                <textarea
                  style={styles.textarea}
                  value={form[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              ) : (
                <input
                  style={styles.input}
                  type={field.type || 'text'}
                  value={form[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
          <div style={styles.buttonRow}>
            <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
            <button style={styles.cancelButton} onClick={onClose} type="button">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(10, 92, 46, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: '640px',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#0a5c2e',
    borderRadius: '1rem',
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
    color: '#e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
  },
  title: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#f8fafc',
  },
  closeButton: {
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  content: {
    padding: '1.5rem',
    display: 'grid',
    gap: '1rem',
  },
  fieldRow: {
    display: 'grid',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.85rem',
    color: '#cbd5e1',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    borderRadius: '0.75rem',
    border: '1px solid rgba(148,163,184,0.18)',
    background: '#020617',
    color: '#e2e8f0',
    padding: '0.85rem 1rem',
    fontSize: '0.95rem',
  },
  textarea: {
    width: '100%',
    minHeight: '100px',
    borderRadius: '0.75rem',
    border: '1px solid rgba(148,163,184,0.18)',
    background: '#020617',
    color: '#e2e8f0',
    padding: '0.85rem 1rem',
    fontSize: '0.95rem',
    resize: 'vertical',
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  saveButton: {
    background: '#22c55e',
    color: '#071b18',
    border: 'none',
    borderRadius: '0.85rem',
    padding: '0.85rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 700,
  },
  cancelButton: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: '0.85rem',
    padding: '0.85rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
