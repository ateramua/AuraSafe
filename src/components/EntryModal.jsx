// src/components/EntryModal.jsx
import { useState, useEffect } from 'react';
import PasswordGenerator from './PasswordGenerator';

// Category fields for different entry types
const categoryFields = {
  credential: [
    { label: 'Name', name: 'title', type: 'text', required: true },
    { label: 'Username/Email', name: 'username', type: 'text' },
    { label: 'Password', name: 'password', type: 'password' },
    { label: 'TOTP Secret', name: 'totpSecret', type: 'text', placeholder: 'Enter secret key from QR code (optional)' },
    { label: 'Passkey ID', name: 'passkeyId', type: 'text', placeholder: 'Credential ID from service (optional)' },
    { label: 'Website URL', name: 'url', type: 'url', placeholder: 'https://example.com' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  passkey: [
    { label: 'Service Name', name: 'title', type: 'text', required: true },
    { label: 'Username/Email', name: 'username', type: 'text' },
    { label: 'Passkey ID', name: 'passkeyId', type: 'text', placeholder: 'Credential ID from service' },
    { label: 'Service URL', name: 'url', type: 'url', placeholder: 'https://example.com' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  contact: [
    { label: 'Full Name', name: 'title', type: 'text', required: true },
    { label: 'Address Line 1', name: 'addressLine', type: 'text', placeholder: 'Street address' },
    { label: 'Address Line 2', name: 'addressLine2', type: 'text', placeholder: 'Apartment, suite, etc. (optional)' },
    { label: 'City', name: 'city', type: 'text' },
    { label: 'State', name: 'state', type: 'text' },
    { label: 'ZIP Code', name: 'zip', type: 'text' },
    { label: 'Country', name: 'country', type: 'text' },
    { label: 'Phone', name: 'phone', type: 'tel', placeholder: '(123) 456-7890' },
    { label: 'Email', name: 'email', type: 'email' },
    { label: 'Company', name: 'company', type: 'text' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  creditCard: [
    { label: 'Cardholder Name', name: 'title', type: 'text', required: true },
    { label: 'Card Number', name: 'cardNumber', type: 'text', placeholder: '1234 5678 9012 3456' },
    { label: 'Expiry Date', name: 'expiry', type: 'text', placeholder: 'MM/YY' },
    { label: 'CVV', name: 'cvv', type: 'password', placeholder: '123' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  bankAccount: [
    { label: 'Account Holder', name: 'title', type: 'text', required: true },
    { label: 'Bank Name', name: 'bankName', type: 'text', placeholder: 'Bank of America' },
    { label: 'Account Number', name: 'accountNumber', type: 'text', placeholder: '123456789' },
    { label: 'Routing Number', name: 'routingNumber', type: 'text', placeholder: '021000021' },
    { label: 'Account Type', name: 'accountType', type: 'text', placeholder: 'Checking / Savings' },
    { label: 'SWIFT/BIC Code', name: 'swiftCode', type: 'text', placeholder: 'For international transfers (optional)' },
    { label: 'Branch Address', name: 'branchAddress', type: 'text', placeholder: 'Bank branch location (optional)' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  driverLicense: [
    { label: 'Full Name', name: 'title', type: 'text', required: true },
    { label: 'License Number', name: 'licenseNumber', type: 'text', placeholder: 'DL12345678' },
    { label: 'State', name: 'state', type: 'text', placeholder: 'CA' },
    { label: 'Expiration Date', name: 'expiry', type: 'text', placeholder: 'MM/DD/YYYY' },
    { label: 'Date of Birth', name: 'dob', type: 'text', placeholder: 'MM/DD/YYYY' },
    { label: 'Class', name: 'licenseClass', type: 'text', placeholder: 'C, A, B, M1, etc.' },
    { label: 'Endorsements', name: 'endorsements', type: 'text', placeholder: 'Motorcycle, Hazmat, etc. (optional)' },
    { label: 'Restrictions', name: 'restrictions', type: 'text', placeholder: 'Corrective lenses, etc. (optional)' },
    { label: 'Issue Date', name: 'issueDate', type: 'text', placeholder: 'MM/DD/YYYY' },
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
};

// Map sidebar category names to field type names
const getEntryTypeFromCategory = (category) => {
  const categoryMap = {
    'passwords': 'credential',
    'passkeys': 'passkey',
    'addresses': 'contact',
    'paymentCards': 'creditCard',
    'bankAccounts': 'bankAccount',
    'driverLicenses': 'driverLicense',
  };
  return categoryMap[category] || 'credential';
};

// Inject styles on client side only
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    input:hover, textarea:hover {
      border-color: #4caf50;
    }
    input:focus, textarea:focus {
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }
    button:hover {
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
    button:active {
      transform: translateY(0);
    }
    .close-btn:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #EF4444;
    }
    .reveal-btn:hover, .hide-btn:hover {
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(styleSheet);
}

export default function EntryModal({
  isOpen,
  entry,
  category,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({});
  const [showGenerator, setShowGenerator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  // Determine entry type from category
  const entryType = entry?.type || getEntryTypeFromCategory(category);
  const fields = categoryFields[entryType] || categoryFields.credential;

  // Load entry data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (entry && entry.id) {
      const loadedData = {};
      fields.forEach(field => {
        loadedData[field.name] = entry[field.name] || '';
      });
      setFormData(loadedData);
    } else {
      const emptyData = {};
      fields.forEach(field => {
        emptyData[field.name] = '';
      });
      setFormData(emptyData);
    }

    setIsSubmitting(false);
    setShowNotes(false);
  }, [isOpen, entry, fields]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const saveData = {
        ...formData,
        category: entryType,
        type: entryType,
        updated_at: Date.now(),
      };

      // Ensure URL has proper format
      if (saveData.url && !saveData.url.startsWith('http://') && !saveData.url.startsWith('https://')) {
        saveData.url = 'https://' + saveData.url;
      }

      if (entry?.id) {
        saveData.id = entry.id;
        saveData.created_at = entry.created_at;
      } else {
        saveData.created_at = Date.now();
      }

      await onSave(saveData);
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save: ' + err.message);
      setIsSubmitting(false);
    }
  };

  // Mask notes function - shows dots instead of actual content
  const maskNotes = (notes) => {
    if (!notes) return '';
    if (notes.length <= 3) return '•'.repeat(notes.length);
    return '•'.repeat(Math.min(notes.length, 20));
  };

  // Get display title for the modal
  const getModalTitle = () => {
    const titleMap = {
      'passwords': 'Password',
      'passkeys': 'Passkey',
      'addresses': 'Address',
      'paymentCards': 'Payment Card',
      'bankAccounts': 'Bank Account',
      'driverLicenses': "Driver's License",
    };
    const baseTitle = titleMap[category] || 'Entry';
    return entry?.id ? `Edit ${baseTitle}` : `Add ${baseTitle}`;
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{getModalTitle()}</h2>
          <button onClick={onClose} style={styles.closeBtn} className="close-btn">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {fields.map((field) => (
            <div key={field.name} style={styles.field}>
              <label style={styles.label}>
                {field.label}
                {field.required && <span style={styles.required}>*</span>}
              </label>

              {field.name === 'password' && entryType === 'credential' ? (
                <div style={styles.passwordContainer}>
                  <input
                    name={field.name}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    style={styles.passwordInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGenerator(true)}
                    style={styles.generateBtn}
                  >
                    🔐 Generate
                  </button>
                </div>
              ) : field.name === 'notes' ? (
                <div style={styles.notesContainer}>
                  <textarea
                    name={field.name}
                    value={showNotes ? formData[field.name] || '' : maskNotes(formData[field.name] || '')}
                    onChange={handleChange}
                    placeholder={field.placeholder || "Add any additional notes..."}
                    rows="3"
                    style={styles.textarea}
                    onFocus={() => setShowNotes(true)}
                    onBlur={() => {
                      if (!formData.notes) {
                        setShowNotes(false);
                      }
                    }}
                  />
                  {formData.notes && !showNotes && (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      style={styles.revealNotesBtn}
                      title="Click to view notes"
                    >
                      👁️ Reveal
                    </button>
                  )}
                  {showNotes && formData.notes && (
                    <button
                      type="button"
                      onClick={() => setShowNotes(false)}
                      style={styles.hideNotesBtn}
                      title="Hide notes"
                    >
                      🙈 Hide
                    </button>
                  )}
                </div>
              ) : field.name === 'url' || field.name === 'serviceUrl' ? (
                <div>
                  <input
                    name={field.name}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={handleChange}
                    placeholder={field.placeholder || "https://example.com"}
                    style={styles.input}
                  />
                  <div style={styles.urlHint}>
                    💡 Add the website URL to enable auto-fill and quick launch
                  </div>
                </div>
              ) : (
                <input
                  name={field.name}
                  type={field.type}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  style={styles.input}
                />
              )}
            </div>
          ))}

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
              {isSubmitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>

      <PasswordGenerator
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onUsePassword={(p) => setFormData(prev => ({ ...prev, password: p }))}
      />
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
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
  },
  modal: {
    background: '#0f3d24',
    borderRadius: '16px',
    padding: '28px',
    width: '90%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(76, 175, 80, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    background: 'linear-gradient(120deg, #fff, #a5d6a5)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  },
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  },
  field: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#C8E6C9',
  },
  required: {
    color: '#EF4444',
    marginLeft: '4px',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#0f3d24',
    color: '#F3F4F6',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  urlHint: {
    fontSize: '0.7rem',
    color: '#9CA3AF',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  passwordContainer: {
    display: 'flex',
    gap: '10px',
  },
  passwordInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#0f3d24',
    color: '#F3F4F6',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  generateBtn: {
    padding: '10px 18px',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  },
  notesContainer: {
    position: 'relative',
  },
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#0f3d24',
    color: '#F3F4F6',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    resize: 'vertical',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  revealNotesBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(59, 130, 246, 0.8)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.7rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  hideNotesBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(107, 114, 128, 0.8)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.7rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  notesHint: {
    fontSize: '0.7rem',
    color: '#9CA3AF',
    marginTop: '4px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(76, 175, 80, 0.3)',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: '#4B5563',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  saveBtn: {
    padding: '10px 24px',
    background: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
};