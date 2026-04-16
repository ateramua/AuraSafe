// src/components/CategoryModal.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';

const categoryToType = {
    all: null,
    passwords: 'credential',
    addresses: 'contact',
    paymentCards: 'creditCard',
    bankAccounts: 'bankAccount',
    driverLicenses: 'driverLicense',
    help: null,
};

export default function CategoryModal({ isOpen, onClose, category, api }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);

    const entryType = categoryToType[category];

    const fetchEntries = async () => {
        if (!api || category === 'help') {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const allEntries = await api.getVaultEntries();
            let filtered = allEntries;
            if (category !== 'all') {
                filtered = allEntries.filter(e => e.type === entryType);
            }
            setEntries(filtered);
        } catch (err) {
            console.error('Failed to fetch entries:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchEntries();
        }
    }, [isOpen, category]);

    const handleAdd = () => {
        setEditingEntry(null);
        setShowEntryModal(true);
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setShowEntryModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this entry?')) return;
        try {
            await api.deleteVaultEntry(id);
            fetchEntries();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleSaveEntry = async (entryData) => {
        try {
            if (entryData.id) {
                await api.saveVaultEntry(entryData);
            } else {
                const newEntry = { ...entryData, type: entryType, id: Date.now().toString() };
                await api.saveVaultEntry(newEntry);
            }
            setShowEntryModal(false);
            fetchEntries();
        } catch (err) {
            alert('Failed to save entry: ' + err.message);
        }
    };

    if (!isOpen) return null;

    // Help category special display
    if (category === 'help') {
        return (
            <div style={styles.overlay} onClick={onClose}>
                <div style={styles.modal} onClick={e => e.stopPropagation()}>
                    <div style={styles.header}>
                        <h2 style={styles.title}>Help & Support</h2>
                        <button style={styles.closeButton} onClick={onClose}>×</button>
                    </div>
                    <div style={styles.content}>
                        <p>Welcome to AuraSafe Help! Here are some resources:</p>
                        <ul>
                            <li><strong>Documentation:</strong> Getting Started Guide</li>
                            <li><strong>FAQs:</strong> Frequently Asked Questions</li>
                            <li><strong>Support:</strong> Contact Support</li>
                        </ul>
                        <p>For urgent issues, please email support@aurasafe.com.</p>
                    </div>
                </div>
            </div>
        );
    }

    const categoryTitle = {
        all: 'All Items',
        passwords: 'Passwords',
        addresses: 'Addresses',
        paymentCards: 'Payment Cards',
        bankAccounts: 'Bank Accounts',
        driverLicenses: "Driver's Licenses",
    }[category] || category;

    return (
        <>
            <div style={styles.overlay} onClick={onClose}>
                <div style={styles.modal} onClick={e => e.stopPropagation()}>
                    <div style={styles.header}>
                        <h2 style={styles.title}>{categoryTitle}</h2>
                        <button style={styles.closeButton} onClick={onClose}>×</button>
                    </div>
                    <div style={styles.content}>
                        <div style={styles.actions}>
                            <button style={styles.addButton} onClick={handleAdd}>
                                + Add New
                            </button>
                            <button style={styles.cancelButton} onClick={onClose}>
                                Cancel
                            </button>
                        </div>

                        {loading ? (
                            <div style={styles.loading}>Loading entries...</div>
                        ) : entries.length === 0 ? (
                            <div style={styles.empty}>No entries yet. Click "Add New" to create one.</div>
                        ) : (
                            <div style={styles.list}>
                                {entries.map(entry => (
                                    <div key={entry.id} style={styles.listItem}>
                                        <div style={styles.itemInfo}>
                                            <strong>{entry.name || 'Unnamed'}</strong>
                                            {entry.username && <span> – {entry.username}</span>}
                                            {entry.cardNumber && <span> – ****{entry.cardNumber.slice(-4)}</span>}
                                            {entry.bankName && <span> – {entry.bankName}</span>}
                                            {entry.licenseNumber && <span> – {entry.licenseNumber}</span>}
                                        </div>
                                        <div style={styles.itemActions}>
                                            <button style={styles.editButton} onClick={() => handleEdit(entry)}>Edit</button>
                                            <button style={styles.deleteButton} onClick={() => handleDelete(entry.id)}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* EntryModal with higher zIndex to ensure it's visible */}
            <EntryModal
                isOpen={showEntryModal}
                entry={editingEntry}
                category={category}
                onClose={() => setShowEntryModal(false)}
                onSave={handleSaveEntry}
                zIndex={2100}
            />
        </>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
    },
    modal: {
        background: 'linear-gradient(145deg, #1F2A1F, #172417)',
        borderRadius: '1.5rem',
        width: '90%',
        maxWidth: '700px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(76,175,80,0.3)',
        color: '#F3F4F6',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 600,
        background: 'linear-gradient(120deg, #fff, #a5d6a5)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        margin: 0,
    },
    closeButton: {
        background: 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        color: '#fff',
        fontSize: '1.5rem',
        cursor: 'pointer',
        padding: '0.5rem 0.8rem',
        borderRadius: '2rem',
    },
    content: {
        padding: '1.5rem',
        overflowY: 'auto',
        flex: 1,
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '1rem',
        marginBottom: '1.5rem',
    },
    addButton: {
        padding: '0.7rem 1.8rem',
        background: 'linear-gradient(135deg, #2E7D32, #1B5E20)',
        color: 'white',
        border: 'none',
        borderRadius: '2rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        cursor: 'pointer',
    },
    cancelButton: {
        padding: '0.7rem 1.5rem',
        background: 'transparent',
        color: '#C8E6C9',
        border: '1px solid #4caf50',
        borderRadius: '2rem',
        fontSize: '0.9rem',
        fontWeight: '500',
        cursor: 'pointer',
    },
    loading: {
        textAlign: 'center',
        padding: '2rem',
        color: '#9CA3AF',
    },
    empty: {
        textAlign: 'center',
        padding: '2rem',
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    listItem: {
        background: '#111827',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid #2d4a2d',
    },
    itemInfo: {
        flex: 1,
        fontSize: '0.9rem',
        color: '#F3F4F6',
    },
    itemActions: {
        display: 'flex',
        gap: '0.5rem',
    },
    editButton: {
        background: '#ffc107',
        color: '#000',
        border: 'none',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        cursor: 'pointer',
    },
    deleteButton: {
        background: '#dc3545',
        color: '#fff',
        border: 'none',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        cursor: 'pointer',
    },
};