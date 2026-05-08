// src/components/AddressesModal.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';

export default function AddressesModal({ isOpen, onClose, api }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedField, setCopiedField] = useState(null);

  const fetchEntries = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const all = (await api.getVaultEntries()) || [];
      console.log('[AddressesModal] All entries:', all.length);
      // Filter for contact type only using category field
      const filtered = all.filter(e => e.category === 'contact');
      console.log('[AddressesModal] Filtered addresses:', filtered.length);
      setEntries(filtered);
    } catch (err) {
      console.error('[AddressesModal] Error fetching entries:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('[AddressesModal] Modal opened, fetching entries...');
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
      // Ensure type and category are set to contact for addresses
      const saveData = { ...entryData, category: 'contact', type: 'contact' };
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
    if (window.confirm(`Delete ${selectedIds.length} address(es)?`)) {
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
              <h2 style={styles.titleText}>📍 Addresses</h2>
              {entries.length > 0 && <span style={styles.countBadge}>{entries.length} addresses</span>}
            </div>
            <div style={styles.headerActions}>
              <button onClick={handleAdd} style={styles.addBtn}>+ Add Address</button>
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
              <p style={styles.loading}>Loading addresses...</p>
            ) : entries.length === 0 ? (
              <p style={styles.empty}>No addresses yet. Click "Add Address" to create one.</p>
            ) : (
              entries.map(entry => (
                <div key={entry.id} style={styles.item}>
                  <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleSelectOne(entry.id)} style={styles.checkbox} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.itemTitle}>{entry.title || 'Untitled Address'}</div>
                    <div style={styles.subText}>
                      {entry.addressLine && (
                        <span style={styles.copyableField} onClick={() => copyToClipboard(entry.addressLine, 'address', entry.id)}>
                          🏠 {entry.addressLine}
                          {copiedField === `address_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                      )}
                      {entry.city && <span>📍 {entry.city}</span>}
                      {entry.state && <span>{entry.state}</span>}
                      {entry.zip && <span>{entry.zip}</span>}
                      {entry.country && <span>🌍 {entry.country}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleEdit(entry)} style={styles.editBtn}>Edit</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <EntryModal
        isOpen={showEntryModal}
        entry={editingEntry}
        category="addresses"
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
  editBtn: { background: '#8B5CF6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' },
  loading: { textAlign: 'center', padding: '2rem', color: '#c8e6c9' },
  empty: { textAlign: 'center', padding: '2rem', color: '#c8e6c9', fontStyle: 'italic' },
};