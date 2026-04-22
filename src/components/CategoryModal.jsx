// src/components/CategoryModal.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';
import PasskeyModal from './PasskeyModal';
import TOTPDisplay from './TOTPDisplay';

const categoryToType = {
    all: null,
    passwords: 'credential',
    passkeys: 'passkey',
    addresses: 'contact',
    paymentCards: 'creditCard',
    bankAccounts: 'bankAccount',
    driverLicenses: 'driverLicense',
    help: null,
};

// Group titles and icons for display
const groupConfig = {
    credential: { title: '🔐 Credentials', icon: '🔑', order: 1 },
    contact: { title: '📍 Addresses', icon: '🏠', order: 2 },
    creditCard: { title: '💳 Payment Cards', icon: '💳', order: 3 },
    bankAccount: { title: '🏦 Bank Accounts', icon: '🏦', order: 4 },
    driverLicense: { title: '🪪 Driver\'s Licenses', icon: '🪪', order: 5 },
    passkey: { title: '🔐 Passkeys', icon: '🔐', order: 6 },
};

export default function CategoryModal({
    isOpen,
    onClose,
    category,
    api,
}) {
    const [entries, setEntries] = useState([]);
    const [groupedEntries, setGroupedEntries] = useState({});
    const [loading, setLoading] = useState(false);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [copiedField, setCopiedField] = useState(null);
    const [showPassword, setShowPassword] = useState({});
    const [autoFillEnabled, setAutoFillEnabled] = useState({});

    const entryType = categoryToType[category];

    const fetchEntries = async () => {
        if (!api || category === 'help') return;

        setLoading(true);
        try {
            const all = (await api.getVaultEntries()) || [];
            
            // Load auto-fill preferences from localStorage
            const savedAutoFill = localStorage.getItem('aurasafe_autofill_prefs');
            const autoFillPrefs = savedAutoFill ? JSON.parse(savedAutoFill) : {};
            setAutoFillEnabled(autoFillPrefs);
            
            if (category === 'all') {
                // Group entries by type for "All Items" view
                const grouped = {};
                all.forEach(entry => {
                    const type = entry.type || 'credential';
                    if (!grouped[type]) {
                        grouped[type] = [];
                    }
                    grouped[type].push(entry);
                });
                setGroupedEntries(grouped);
                setEntries(all);
            } else {
                const filtered = all.filter((e) => e.type === entryType);
                setEntries(filtered);
                setGroupedEntries({});
            }
        } catch (err) {
            console.error(err);
            setEntries([]);
            setGroupedEntries({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) fetchEntries();
    }, [isOpen, category]);

    // Launch website function
    const launchWebsite = async (url, entryId) => {
        if (!url) return;
        
        // Ensure URL has protocol
        let finalUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            finalUrl = 'https://' + url;
        }
        
        // Open the URL in default browser
        window.open(finalUrl, '_blank');
        
        // If auto-fill is enabled for this entry, attempt to auto-fill when page loads
        if (autoFillEnabled[entryId]) {
            // Store credentials for auto-fill
            const entry = entries.find(e => e.id === entryId) || 
                          Object.values(groupedEntries).flat().find(e => e.id === entryId);
            
            if (entry && (entry.username || entry.email)) {
                localStorage.setItem('aurasafe_pending_autofill', JSON.stringify({
                    entryId: entry.id,
                    username: entry.username || entry.email || '',
                    password: entry.password || '',
                    url: finalUrl,
                    timestamp: Date.now()
                }));
                
                // Show notification that auto-fill is pending
                const notification = document.createElement('div');
                notification.textContent = '🔐 Auto-fill ready: When the page loads, click the AuraSafe extension icon to fill credentials.';
                notification.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: #2e7d32;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    z-index: 100000;
                    font-size: 14px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease;
                `;
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 5000);
            }
        }
    };
    
    // Toggle auto-fill for an entry
    const toggleAutoFill = (entryId, e) => {
        e.stopPropagation();
        const newValue = !autoFillEnabled[entryId];
        const updatedPrefs = { ...autoFillEnabled, [entryId]: newValue };
        setAutoFillEnabled(updatedPrefs);
        localStorage.setItem('aurasafe_autofill_prefs', JSON.stringify(updatedPrefs));
    };

    // Mask password function
    const maskPassword = (password) => {
        if (!password) return '';
        if (password.length <= 4) return '•'.repeat(password.length);
        return '•'.repeat(8);
    };

    // Mask username function (show first 2 and last 2 characters)
    const maskUsername = (username) => {
        if (!username) return '';
        if (username.length <= 4) return username;
        return username.substring(0, 2) + '•'.repeat(Math.min(username.length - 4, 6)) + username.substring(username.length - 2);
    };

    // Toggle password visibility
    const togglePasswordVisibility = (id, e) => {
        e.stopPropagation();
        setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Copy to clipboard function
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

    const handleAdd = () => {
        setEditingEntry(null);
        setShowEntryModal(true);
    };

    const handleEditClick = (clickedEntry) => {
        setEditingEntry(clickedEntry);
        setShowEntryModal(true);
    };

    const handleSaveEntry = async (entryData) => {
        if (isSaving || !api) return;

        setIsSaving(true);

        try {
            await api.saveVaultEntry(entryData);
            setShowEntryModal(false);
            setEditingEntry(null);
            await fetchEntries();
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save entry: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseEntryModal = () => {
        if (isSaving) return;
        setShowEntryModal(false);
        setEditingEntry(null);
    };

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

    // Render a single entry item
    const renderEntryItem = (e) => (
        <div key={e.id} style={styles.item}>
            <input
                type="checkbox"
                checked={selectedIds.includes(e.id)}
                onChange={() => toggleSelectOne(e.id)}
                style={styles.checkbox}
            />

            <div style={{ flex: 1 }}>
                <div style={styles.itemTitle}>
                    {e.title || 'Untitled Entry'}
                </div>
                <div style={styles.subText}>
                    {/* Credential fields */}
                    {e.username && (
                        <span
                            style={styles.copyableField}
                            onClick={() => copyToClipboard(e.username, 'username', e.id)}
                            title="Click to copy username"
                        >
                            👤 {maskUsername(e.username)}
                            {copiedField === `username_${e.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                    )}
                    {e.password && (
                        <span style={styles.passwordWrapper}>
                            <span
                                style={styles.copyableField}
                                onClick={() => copyToClipboard(e.password, 'password', e.id)}
                                title="Click to copy password"
                            >
                                🔒 {showPassword[e.id] ? e.password : maskPassword(e.password)}
                            </span>
                            <button
                                onClick={(event) => togglePasswordVisibility(e.id, event)}
                                style={styles.eyeButton}
                                title={showPassword[e.id] ? "Hide password" : "Show password"}
                            >
                                {showPassword[e.id] ? '🙈' : '👁️'}
                            </button>
                            {copiedField === `password_${e.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                    )}
                    {e.url && (
                        <span style={styles.urlField}>
                            🔗 {e.url}
                        </span>
                    )}
                    {/* Contact/Address fields */}
                    {e.addressLine && (
                        <span>📍 {e.addressLine}</span>
                    )}
                    {e.city && e.state && (
                        <span>🏙️ {e.city}, {e.state}</span>
                    )}
                    {/* Credit Card fields */}
                    {e.cardNumber && (
                        <span>💳 ••••{e.cardNumber.slice(-4)}</span>
                    )}
                    {e.expiry && (
                        <span>📅 {e.expiry}</span>
                    )}
                    {/* Bank Account fields */}
                    {e.bankName && (
                        <span>🏦 {e.bankName}</span>
                    )}
                    {e.accountNumber && (
                        <span>🔢 ••••{e.accountNumber.slice(-4)}</span>
                    )}
                    {/* Driver License fields */}
                    {e.licenseNumber && (
                        <span>📄 License: {e.licenseNumber}</span>
                    )}
                    {e.dob && (
                        <span>🎂 {e.dob}</span>
                    )}
                    {/* Passkey fields */}
                    {e.type === 'passkey' && e.passkeyId && (
                        <span
                            style={styles.copyableField}
                            onClick={() => copyToClipboard(e.passkeyId, 'passkeyId', e.id)}
                            title="Click to copy passkey ID"
                        >
                            🔑 Passkey ID
                            {copiedField === `passkeyId_${e.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                    )}
                </div>
                {/* TOTP Display */}
                {e.totpSecret && (
                    <div style={{ marginTop: '8px' }}>
                        <TOTPDisplay secret={e.totpSecret} label="2FA Code" />
                    </div>
                )}
            </div>

            <div style={styles.actionButtons}>
                {/* Launch Button - only show if URL exists and it's a credential/password entry */}
                {e.url && (e.type === 'credential' || e.type === 'passkey') && (
                    <button
                        onClick={() => launchWebsite(e.url, e.id)}
                        style={styles.launchBtn}
                        title="Launch website"
                    >
                        🚀 Launch
                    </button>
                )}
                
                {/* Auto-fill Toggle Button */}
                {(e.type === 'credential' || e.type === 'passkey') && e.url && (
                    <button
                        onClick={(event) => toggleAutoFill(e.id, event)}
                        style={{
                            ...styles.autoFillBtn,
                            background: autoFillEnabled[e.id] ? '#2e7d32' : '#4B5563',
                        }}
                        title={autoFillEnabled[e.id] ? "Auto-fill enabled - Click to disable" : "Auto-fill disabled - Click to enable"}
                    >
                        {autoFillEnabled[e.id] ? '🔓 Auto-fill ON' : '🔒 Auto-fill OFF'}
                    </button>
                )}
                
                <button
                    onClick={() => handleEditClick(e)}
                    style={styles.editBtn}
                >
                    Edit
                </button>
            </div>
        </div>
    );

    // Render grouped entries for "All Items"
    const renderGroupedEntries = () => {
        // Sort groups by order
        const sortedGroups = Object.keys(groupedEntries).sort((a, b) => {
            const orderA = groupConfig[a]?.order || 999;
            const orderB = groupConfig[b]?.order || 999;
            return orderA - orderB;
        });

        return sortedGroups.map(groupType => {
            const group = groupedEntries[groupType];
            const config = groupConfig[groupType] || { title: groupType, icon: '📄' };
            
            return (
                <div key={groupType} style={styles.groupSection}>
                    <div style={styles.groupHeader}>
                        <span style={styles.groupIcon}>{config.icon}</span>
                        <h3 style={styles.groupTitle}>{config.title}</h3>
                        <span style={styles.groupCount}>({group.length})</span>
                    </div>
                    <div style={styles.groupContent}>
                        {group.map(entry => renderEntryItem(entry))}
                    </div>
                </div>
            );
        });
    };

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

    // Handle Passkey category - opens the PasskeyModal
    if (category === 'passkeys') {
        return (
            <PasskeyModal
                isOpen={isOpen}
                onClose={onClose}
                api={api}
            />
        );
    }

    if (!isOpen) return null;

    const categoryTitle = {
        all: 'All Items',
        passwords: 'Passwords',
        passkeys: 'Passkeys',
        addresses: 'Addresses',
        paymentCards: 'Payment Cards',
        bankAccounts: 'Bank Accounts',
        driverLicenses: "Driver's Licenses",
    }[category] || category;

    const isAllItems = category === 'all';

    return (
        <>
            <div style={styles.overlay} onClick={onClose}>
                <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <div style={styles.header}>
                        <div style={styles.titleWrap}>
                            <h2 style={styles.titleText}>{categoryTitle}</h2>
                            {!isAllItems && entries.length > 0 && (
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

                    <div style={styles.content}>
                        {!isAllItems && entries.length > 0 && (
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
                        ) : isAllItems ? (
                            Object.keys(groupedEntries).length === 0 ? (
                                <p style={styles.empty}>No entries yet. Click "Add Entry" to create one.</p>
                            ) : (
                                renderGroupedEntries()
                            )
                        ) : entries.length === 0 ? (
                            <p style={styles.empty}>No entries yet. Click "Add Entry" to create one.</p>
                        ) : (
                            <div>
                                {entries.map((e) => renderEntryItem(e))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <EntryModal
                isOpen={showEntryModal}
                entry={editingEntry}
                category={category}
                onClose={handleCloseEntryModal}
                onSave={handleSaveEntry}
            />
        </>
    );
}

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
        maxWidth: '750px',
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
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        background: '#1a4a1f',
        borderRadius: '0.5rem',
        transition: 'all 0.2s ease',
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
        gap: '12px',
        alignItems: 'center',
    },
    copyableField: {
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '4px',
        transition: 'all 0.2s ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
    passwordWrapper: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
    eyeButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '2px 4px',
        borderRadius: '4px',
        transition: 'all 0.2s ease',
    },
    urlField: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
    },
    copiedIndicator: {
        color: '#10B981',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '4px',
    },
    actionButtons: {
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
    },
    launchBtn: {
        background: '#3B82F6',
        color: '#fff',
        border: 'none',
        padding: '6px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '500',
    },
    autoFillBtn: {
        color: '#fff',
        border: 'none',
        padding: '6px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '500',
        transition: 'all 0.2s ease',
    },
    editBtn: {
        background: '#8B5CF6',
        color: '#fff',
        border: 'none',
        padding: '6px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '500',
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
    // Group styles
    groupSection: {
        marginBottom: '1.5rem',
    },
    groupHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(76, 175, 80, 0.3)',
    },
    groupIcon: {
        fontSize: '1.2rem',
    },
    groupTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#C8E6C9',
        margin: 0,
    },
    groupCount: {
        fontSize: '0.75rem',
        color: '#9CA3AF',
    },
    groupContent: {
        paddingLeft: '0.5rem',
    },
};

// Add hover styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .copyable-field:hover {
        background: rgba(59, 130, 246, 0.3);
        transform: scale(1.02);
    }
    .eye-button:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    .item:hover {
        background: #2a5a2f;
        transform: translateX(2px);
    }
    button:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
    }
    button:active {
        transform: translateY(0);
    }
`;
document.head.appendChild(styleSheet);