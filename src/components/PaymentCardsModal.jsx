// src/components/PaymentCardsModal.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';

export default function PaymentCardsModal({ isOpen, onClose, api }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedField, setCopiedField] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  const fetchEntries = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const all = (await api.getVaultEntries()) || [];
      console.log('[PaymentCardsModal] All entries:', all.length);
      // Filter for creditCard type only using category field
      const filtered = all.filter(e => e.category === 'creditCard');
      console.log('[PaymentCardsModal] Filtered cards:', filtered.length);
      setEntries(filtered);
    } catch (err) {
      console.error('[PaymentCardsModal] Error fetching entries:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('[PaymentCardsModal] Modal opened, fetching entries...');
      fetchEntries();
    }
  }, [isOpen]);

  const handleAdd = () => {
    setEditingEntry(null);
    setShowEntryModal(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowEntryModal(true);
  };

  const handleSaveEntry = async (entryData) => {
    if (isSaving || !api) return;
    setIsSaving(true);

    try {
      // Ensure type and category are set to creditCard for payment cards
      const saveData = { ...entryData, category: 'creditCard', type: 'creditCard' };
      await api.saveVaultEntry(saveData);
      setShowEntryModal(false);
      setEditingEntry(null);
      await fetchEntries();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text, fieldName, entryId) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(`${fieldName}_${entryId}`);
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

  const maskCVV = (cvv) => {
    if (!cvv) return '';
    return '•••';
  };

  const handleIndividualDelete = async (entryId, entryTitle) => {
    if (!api) return;
    
    if (window.confirm(`Delete "${entryTitle || 'this card'}"? This action cannot be undone.`)) {
      setDeletingEntryId(entryId);
      try {
        await api.deleteVaultEntry(entryId);
        setSelectedIds(prev => prev.filter(id => id !== entryId));
        await fetchEntries();
      } catch (err) {
        console.error('Delete failed:', err);
        alert('Failed to delete: ' + err.message);
      } finally {
        setDeletingEntryId(null);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === entries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map(e => e.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!api || selectedIds.length === 0) return;
    if (window.confirm(`Delete ${selectedIds.length} payment card(s)?`)) {
      try {
        await Promise.all(selectedIds.map(id => api.deleteVaultEntry(id)));
        setSelectedIds([]);
        await fetchEntries();
      } catch (err) {
        console.error('Bulk delete failed:', err);
        alert('Failed to delete: ' + err.message);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.header}>
            <div style={styles.titleWrap}>
              <h2 style={styles.titleText}>💳 Payment Cards</h2>
              {entries.length > 0 && <span style={styles.countBadge}>{entries.length} cards</span>}
            </div>
            <div style={styles.headerActions}>
              <button onClick={handleAdd} style={styles.addBtn}>+ Add Card</button>
              <button onClick={onClose} style={styles.closeBtn}>✕</button>
            </div>
          </div>

          <div style={styles.content}>
            {entries.length > 0 && (
              <div style={styles.topBar}>
                <label style={styles.selectAll}>
                  <input type="checkbox" checked={selectedIds.length === entries.length} onChange={toggleSelectAll} />
                  Select All
                </label>
                {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete} style={styles.deleteBulk}>
                    Delete ({selectedIds.length})
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <p style={styles.loading}>Loading payment cards...</p>
            ) : entries.length === 0 ? (
              <p style={styles.empty}>No payment cards yet. Click "Add Card" to create one.</p>
            ) : (
              entries.map(entry => (
                <div key={entry.id} style={styles.item}>
                  <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleSelectOne(entry.id)} style={styles.checkbox} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.itemTitle}>{entry.title || 'Untitled Card'}</div>
                    <div style={styles.subText}>
                      {entry.cardNumber && (
                        <span style={styles.copyableField} onClick={() => copyToClipboard(entry.cardNumber, 'card', entry.id)}>
                          💳 {maskCardNumber(entry.cardNumber)}
                          {copiedField === `card_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                      )}
                      {entry.expiry && <span>📅 Expires: {entry.expiry}</span>}
                      {entry.cvv && (
                        <span style={styles.copyableField} onClick={() => copyToClipboard(entry.cvv, 'cvv', entry.id)}>
                          🔒 CVV: {maskCVV(entry.cvv)}
                          {copiedField === `cvv_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <div style={styles.notesText}>📝 {entry.notes}</div>
                    )}
                  </div>
                  <div style={styles.actionButtons}>
                    <button onClick={() => handleEdit(entry)} style={styles.editBtn}>Edit</button>
                    <button onClick={() => handleIndividualDelete(entry.id, entry.title)} style={styles.deleteBtn} disabled={deletingEntryId === entry.id}>
                      {deletingEntryId === entry.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <EntryModal
        isOpen={showEntryModal}
        entry={editingEntry}
        category="paymentCards"
        onClose={() => { setShowEntryModal(false); setEditingEntry(null); }}
        onSave={handleSaveEntry}
      />
    </>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 },
  modal: { background: '#0f3d24', padding: '1.5rem', borderRadius: '1rem', width: '90%', maxWidth: '750px', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(76,175,80,0.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(76,175,80,0.3)' },
  titleWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  titleText: { margin: 0, fontSize: '1.5rem', fontWeight: 600, background: 'linear-gradient(120deg, #fff, #a5d6a5)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' },
  countBadge: { background: '#1b5e20', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
  headerActions: { display: 'flex', gap: '10px' },
  addBtn: { background: 'linear-gradient(135deg, #2e7d32, #1b5e20)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' },
  closeBtn: { background: 'rgba(255,255,255,0.08)', color: '#fff', width: '38px', height: '38px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '18px' },
  content: { marginTop: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  selectAll: { fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  deleteBulk: { background: '#b91c1c', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  item: { display: 'flex', alignItems: 'center', gap: '10px', padding: '0.75rem', marginBottom: '0.5rem', background: '#1a4a1f', borderRadius: '0.5rem' },
  checkbox: { width: '18px', height: '18px', accentColor: '#2e7d32', cursor: 'pointer' },
  itemTitle: { fontWeight: 600, marginBottom: '4px' },
  subText: { fontSize: '12px', opacity: 0.75, display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
  copyableField: { cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  copiedIndicator: { color: '#10B981', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' },
  notesText: { fontSize: '11px', color: '#9CA3AF', marginTop: '4px', fontStyle: 'italic' },
  actionButtons: { display: 'flex', gap: '6px', alignItems: 'center' },
  editBtn: { background: '#8B5CF6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' },
  deleteBtn: { background: '#6B7280', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' },
  loading: { textAlign: 'center', padding: '2rem', color: '#c8e6c9' },
  empty: { textAlign: 'center', padding: '2rem', color: '#c8e6c9', fontStyle: 'italic' },
};