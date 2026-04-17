// src/components/EntryModal.jsx
import { useState, useEffect } from 'react';
import PasswordGenerator from './PasswordGenerator';

export default function EntryModal({
  isOpen,
  entry,
  category,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: '',
  });
  const [showGenerator, setShowGenerator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load entry data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (entry && entry.id) {
      // Direct flat mapping from database fields
      setFormData({
        title: entry.title || '',
        username: entry.username || '',
        password: entry.password || '',
        url: entry.url || '',
        notes: entry.notes || '',
      });
      console.log('Loaded entry data:', {
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        notes: entry.notes,
      });
    } else {
      // New entry - empty form
      setFormData({
        title: '',
        username: '',
        password: '',
        url: '',
        notes: '',
      });
    }
    
    setIsSubmitting(false);
  }, [isOpen, entry]);

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
        category: 'credential',
        updated_at: Date.now(),
      };

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

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{entry?.id ? 'Edit Entry' : `Add ${category}`}</h2>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label>Name *</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div style={styles.field}>
            <label>Username</label>
            <input
              name="username"
              value={formData.username}
              onChange={handleChange}
            />
          </div>

          <div style={styles.field}>
            <label>Password</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={() => setShowGenerator(true)}>
                Generate
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label>URL</label>
            <input
              name="url"
              value={formData.url}
              onChange={handleChange}
            />
          </div>

          <div style={styles.field}>
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div style={styles.actions}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
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
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
  },
  modal: {
    background: '#1a4a1f',
    padding: '24px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    color: 'white',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: { margin: 0 },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
  },
  field: { marginBottom: '15px' },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
};