import { useState, useEffect } from 'react';

const generatePassword = (length = 16) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
};

export default function EntryModal({ isOpen, entry, onClose, onSave }) {
  const [formData, setFormData] = useState({
    type: 'credential',
    name: '',
    username: '',
    password: '',
    url: '',
    address: '',
    phone: '',
    email: '',
    notes: '',
    folder: '',
    customFields: {}
  });

  useEffect(() => {
    if (entry) {
      setFormData({
        type: entry.type || 'credential',
        name: entry.name || '',
        username: entry.username || '',
        password: entry.password || '',
        url: entry.url || '',
        address: entry.address || '',
        phone: entry.phone || '',
        email: entry.email || '',
        notes: entry.notes || '',
        folder: entry.folder || '',
        customFields: entry.customFields || {}
      });
    } else {
      setFormData({
        type: 'credential',
        name: '',
        username: '',
        password: '',
        url: '',
        address: '',
        phone: '',
        email: '',
        notes: '',
        folder: '',
        customFields: {}
      });
    }
  }, [entry, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGeneratePassword = () => {
    setFormData(prev => ({ ...prev, password: generatePassword() }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, id: entry?.id });
  };

  if (!isOpen) return null;

  const isCredential = formData.type === 'credential';

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{entry ? 'Edit Entry' : 'Add Entry'}</h2>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>🔖 Entry Type</label>
            <select name="type" value={formData.type} onChange={handleChange} style={styles.select}>
              <option value="credential">🔐 Credentials (Login/Password)</option>
              <option value="contact">📞 Contact (Address, Phone, Email)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📛 Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={styles.input}
              required
              placeholder="e.g., Google Account"
            />
          </div>

          {isCredential && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>👤 Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="username@example.com"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>🔒 Password</label>
                <div style={styles.passwordWrapper}>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    style={styles.passwordInput}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    style={styles.generateButton}
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>🌐 URL</label>
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}

          {!isCredential && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>🏠 Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  style={styles.textarea}
                  rows={2}
                  placeholder="Street, city, ZIP"
                />
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>📞 Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="+1 234 567 890"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>📧 Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="contact@example.com"
                  />
                </div>
              </div>
              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>👤 Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    style={styles.input}
                    placeholder="Username for login"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>🔒 Password</label>
                  <div style={styles.passwordWrapper}>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      style={styles.passwordInput}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      style={styles.generateButton}
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>🌐 URL</label>
                <input
                  type="url"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                  style={styles.input}
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>📝 Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              style={styles.textarea}
              rows={3}
              placeholder="Additional notes…"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📁 Folder (optional)</label>
            <input
              type="text"
              name="folder"
              value={formData.folder}
              onChange={handleChange}
              style={styles.input}
              placeholder="e.g., Work, Personal"
            />
          </div>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" style={styles.saveButton}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modalContent: {
    background: '#1F2937',
    borderRadius: '1rem',
    padding: '1.5rem 2rem',
    width: '90%',
    maxWidth: '640px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    color: '#F3F4F6',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    borderBottom: '1px solid #374151',
    paddingBottom: '0.75rem',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'white',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    fontSize: '1.75rem',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 0.5rem',
    transition: 'color 0.2s',
    ':hover': {
      color: '#EF4444',
    },
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#9CA3AF',
    fontSize: '0.875rem',
    fontWeight: '500',
    letterSpacing: '0.025em',
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
    fontSize: '0.875rem',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    ':focus': {
      outline: 'none',
      borderColor: '#3B82F6',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
    },
    '::placeholder': {
      color: '#6B7280',
    },
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    transition: 'border-color 0.2s',
    ':focus': {
      outline: 'none',
      borderColor: '#3B82F6',
    },
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
    fontSize: '0.875rem',
    cursor: 'pointer',
    ':focus': {
      outline: 'none',
      borderColor: '#3B82F6',
    },
  },
  passwordWrapper: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: '0.75rem',
    background: '#111827',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    color: '#F3F4F6',
    fontSize: '0.875rem',
    ':focus': {
      outline: 'none',
      borderColor: '#3B82F6',
    },
  },
  generateButton: {
    padding: '0.75rem 1rem',
    background: '#3B82F6',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    ':hover': {
      background: '#2563EB',
    },
    ':active': {
      transform: 'scale(0.98)',
    },
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '2rem',
    paddingTop: '1rem',
    borderTop: '1px solid #374151',
  },
  saveButton: {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    },
    ':active': {
      transform: 'translateY(0)',
    },
  },
  cancelButton: {
    padding: '0.75rem 1.5rem',
    background: '#4B5563',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'background 0.2s',
    ':hover': {
      background: '#6B7280',
    },
  },
};