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
      setFormData({
        title: entry.title || '',
        username: entry.username || '',
        password: entry.password || '',
        url: entry.url || '',
        notes: entry.notes || '',
      });
    } else {
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
            <label style={styles.label}>
              Name <span style={styles.required}>*</span>
            </label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter entry name"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordContainer}>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
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
          </div>

          <div style={styles.field}>
            <label style={styles.label}>URL</label>
            <input
              name="url"
              value={formData.url}
              onChange={handleChange}
              placeholder="https://example.com"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Add any additional notes..."
              rows="3"
              style={styles.textarea}
            />
          </div>

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
    background: '#1F2937',
    borderRadius: '16px',
    padding: '28px',
    width: '90%',
    maxWidth: '520px',
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
    background: '#111827',
    color: '#F3F4F6',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
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
    background: '#111827',
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
  textarea: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #374151',
    background: '#111827',
    color: '#F3F4F6',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
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

// Add hover effects
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
`;
document.head.appendChild(styleSheet);