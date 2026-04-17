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

export default function CategoryModal({
    isOpen,
    onClose,
    category,
    api,
}) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const entryType = categoryToType[category];

    // =========================
    // FETCH ENTRIES
    // =========================
    const fetchEntries = async () => {
        if (!api || category === 'help') return;

        setLoading(true);
        try {
            const all = (await api.getVaultEntries()) || [];

            const filtered =
                category === 'all'
                    ? all
                    : all.filter((e) => e.type === entryType);

            setEntries(filtered);
        } catch (err) {
            console.error(err);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchEntries();
    }, [isOpen, category]);

    // =========================
    // ADD / EDIT
    // =========================
    const handleAdd = () => {
        if (showEntryModal) return;
        setEditingEntry(null);
        setShowEntryModal(true);
    };

    // SIMPLIFIED EDIT - preserves full data structure without flattening
    const handleEdit = (entry) => {
        if (showEntryModal) return;

        setEditingEntry({
            id: entry.id,
            type: entry.type,
            title: entry.title,
            data: entry.data || {},
        });

        setShowEntryModal(true);
    };

    // =========================
    // SAVE ENTRY (UNIFIED FOR ALL TYPES)
    // =========================
    const handleSaveEntry = async (entryData) => {
        if (isSaving || !api) return;

        setIsSaving(true);

        try {
            const payload = {
                id: entryData.id,
                type: entryData.type || entryType,
                data: entryData.data || {},
                title:
                    entryData.title ||
                    entryData.data?.name ||
                    entryData.data?.bankName ||
                    entryData.data?.cardNumber ||
                    entryData.data?.addressLine1 ||
                    'Untitled Entry',
            };

            await api.saveVaultEntry(payload);

            setShowEntryModal(false);
            setEditingEntry(null);

            await fetchEntries();
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseEntryModal = () => {
        if (isSaving) return;
        setShowEntryModal(false);
        setEditingEntry(null);
    };

    // =========================
    // SELECTION
    // =========================
    const toggleSelectAll = () => {
        if (selectedIds.length === entries.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(entries.map((e) => e.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((x) => x !== id)
                : [...prev, id]
        );
    };

    // =========================
    // DELETE
    // =========================
    const handleBulkDelete = async () => {
        if (!api || selectedIds.length === 0) return;

        if (window.confirm(`Delete ${selectedIds.length} selected item(s)?`)) {
            try {
                await Promise.all(
                    selectedIds.map((id) => api.deleteVaultEntry(id))
                );
                setSelectedIds([]);
                await fetchEntries();
            } catch (err) {
                console.error('Bulk delete failed:', err);
                alert('Failed to delete entries: ' + err.message);
            }
        }
    };

    // =========================
    // HELP CATEGORY
    // =========================
    if (category === 'help') {
        return (
            <div style={styles.overlay} onClick={onClose}>
                <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <div style={styles.header}>
                        <h2 style={styles.titleText}>Help & Support</h2>
                        <button onClick={onClose} style={styles.closeBtn}>✕</button>
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

    if (!isOpen) return null;

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
                <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                    {/* HEADER */}
                    <div style={styles.header}>
                        <div style={styles.titleWrap}>
                            <h2 style={styles.titleText}>{categoryTitle}</h2>
                            {entries.length > 0 && (
                                <span style={styles.countBadge}>
                                    {entries.length} items
                                </span>
                            )}
                        </div>

                        <div style={styles.headerActions}>
                            <button onClick={handleAdd} style={styles.addBtn}>
                                + Add Entry
                            </button>
                            <button onClick={onClose} style={styles.closeBtn}>
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* CONTENT */}
                    <div style={styles.content}>
                        {entries.length > 0 && (
                            <div style={styles.topBar}>
                                <label style={styles.selectAll}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === entries.length}
                                        onChange={toggleSelectAll}
                                    />
                                    Select All
                                </label>

                                {selectedIds.length > 0 && (
                                    <button
                                        onClick={handleBulkDelete}
                                        style={styles.deleteBulk}
                                    >
                                        Delete ({selectedIds.length})
                                    </button>
                                )}
                            </div>
                        )}

                        {loading ? (
                            <p style={styles.loading}>Loading entries...</p>
                        ) : entries.length === 0 ? (
                            <p style={styles.empty}>No entries yet. Click "Add Entry" to create one.</p>
                        ) : (
                            entries.map((e) => {
                                const d = e.data || {};
                                return (
                                    <div key={e.id} style={styles.item}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(e.id)}
                                            onChange={() => toggleSelectOne(e.id)}
                                            style={styles.checkbox}
                                        />

                                        <div style={{ flex: 1 }}>
                                            <div style={styles.itemTitle}>
                                                {e.title ||
                                                    d.name ||
                                                    d.fullName ||
                                                    d.addressLine ||
                                                    'Untitled Entry'}
                                            </div>

                                            <div style={styles.subText}>
                                                {/* Credential fields */}
                                                {d.username && <span>👤 {d.username}</span>}
                                                {d.url && <span>🔗 {d.url}</span>}

                                                {/* Contact/Address fields */}
                                                {d.fullName && <span>👤 {d.fullName}</span>}
                                                {d.addressLine && <span>📍 {d.addressLine}</span>}
                                                {d.city && <span>🏙️ {d.city}</span>}
                                                {d.state && <span>📌 {d.state}</span>}
                                                {d.phone && <span>📞 {d.phone}</span>}
                                                {d.email && <span>📧 {d.email}</span>}

                                                {/* Credit Card fields */}
                                                {d.cardNumber && <span>💳 ••••{d.cardNumber.slice(-4)}</span>}
                                                {d.expiry && <span>📅 {d.expiry}</span>}

                                                {/* Bank Account fields */}
                                                {d.bankName && <span>🏦 {d.bankName}</span>}
                                                {d.accountNumber && <span>🔢 ••••{d.accountNumber.slice(-4)}</span>}

                                                {/* Driver License fields */}
                                                {d.licenseNumber && <span>📄 License: {d.licenseNumber}</span>}
                                                {d.dob && <span>🎂 {d.dob}</span>}
                                            </div>
                                        </div>

                                        <button onClick={() => handleEdit(e)} style={styles.editBtn}>
                                            Edit
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ENTRY MODAL */}
            <EntryModal
                isOpen={showEntryModal}
                entry={editingEntry}
                category={category}
                categoryType={entryType}
                onClose={handleCloseEntryModal}
                onSave={handleSaveEntry}
                zIndex={100000}
            />
        </>
    );
}

// =========================
// STYLES
// =========================
const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
    },

    modal: {
        background: '#0f3d24',
        padding: '1.5rem',
        borderRadius: '1rem',
        width: '90%',
        maxWidth: '650px',
        color: '#fff',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(76,175,80,0.3)',
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(76,175,80,0.3)',
    },

    titleWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },

    titleText: {
        margin: 0,
        fontSize: '1.5rem',
        fontWeight: 600,
        background: 'linear-gradient(120deg, #fff, #a5d6a5)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
    },

    countBadge: {
        background: '#1b5e20',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
    },

    headerActions: {
        display: 'flex',
        gap: '10px',
    },

    addBtn: {
        background: 'linear-gradient(135deg, #2e7d32, #1b5e20)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)',
        padding: '8px 16px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontWeight: '600',
        transition: 'all 0.2s ease',
    },

    closeBtn: {
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.15)',
        cursor: 'pointer',
        fontSize: '18px',
        transition: 'all 0.2s ease',
    },

    content: {
        marginTop: '1rem',
        maxHeight: '60vh',
        overflowY: 'auto',
        paddingRight: '0.5rem',
    },

    topBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },

    selectAll: {
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
    },

    deleteBulk: {
        background: '#b91c1c',
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.2s ease',
    },

    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        background: '#1a4a1f',
        borderRadius: '0.5rem',
        transition: 'transform 0.2s ease',
    },

    checkbox: {
        width: '18px',
        height: '18px',
        accentColor: '#2e7d32',
        cursor: 'pointer',
    },

    itemTitle: {
        fontWeight: 600,
        marginBottom: '4px',
    },

    subText: {
        fontSize: '12px',
        opacity: 0.75,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
    },

    editBtn: {
        background: '#3B82F6',
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'all 0.2s ease',
    },

    loading: {
        textAlign: 'center',
        padding: '2rem',
        color: '#c8e6c9',
    },

    empty: {
        textAlign: 'center',
        padding: '2rem',
        color: '#c8e6c9',
        fontStyle: 'italic',
    },
};