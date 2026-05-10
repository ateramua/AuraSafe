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
    const [autofillStatus, setAutofillStatus] = useState({});

    const entryType = categoryToType[category];

    // Load autofill preferences from localStorage
    const loadAutofillPrefs = () => {
        const saved = localStorage.getItem('aurasafe_autofill_prefs');
        if (saved) {
            setAutofillStatus(JSON.parse(saved));
        }
    };

    // Save autofill preferences to localStorage
    const saveAutofillPrefs = (newStatus) => {
        localStorage.setItem('aurasafe_autofill_prefs', JSON.stringify(newStatus));
        setAutofillStatus(newStatus);
    };

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
            loadAutofillPrefs();
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

    // Launch URL in external browser
    const handleLaunch = async (entry) => {
        if (!entry.url) {
            alert('No URL saved for this entry');
            return;
        }

        let url = entry.url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        try {
            // Open URL in external browser
            if (window.api && typeof window.api.openExternal === 'function') {
                await window.api.openExternal(url);
            } else if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                await window.electronAPI.openExternal(url);
            } else {
                window.open(url, '_blank');
            }

            // If autofill is enabled for this entry, wait a bit then attempt to autofill
            if (autofillStatus[entry.id]) {
                setTimeout(async () => {
                    await handleAutofill(entry, url);
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to launch URL:', err);
            alert('Failed to open URL: ' + err.message);
        }
    };

    // Autofill credentials on the opened webpage
    const handleAutofill = async (entry, url) => {
        try {
            // Try to autofill using the browser extension API
            if (window.api && typeof window.api.autofill === 'function') {
                await window.api.autofill({
                    url: url,
                    username: entry.username || '',
                    password: entry.password || ''
                });
            } else if (chrome && chrome.tabs) {
                // Alternative: use chrome extension API
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'autofill',
                        data: {
                            username: entry.username || '',
                            password: entry.password || ''
                        }
                    });
                }
            } else {
                console.log('No autofill API available. Credentials:', {
                    username: entry.username,
                    password: '***'
                });
            }
        } catch (err) {
            console.error('Autofill failed:', err);
        }
    };

    // Toggle autofill for an entry
    const toggleAutofill = (entryId) => {
        const newStatus = { ...autofillStatus, [entryId]: !autofillStatus[entryId] };
        saveAutofillPrefs(newStatus);
    };

    // Helper to get display text for an entry based on category
    const getEntryDisplay = (entry) => {
        switch (entryType) {
            case 'credential':
                return {
                    primary: entry.name || entry.title || 'Untitled',
                    secondary: entry.username,
                    // ✅ FIX: Display generic "URL" label instead of actual URL
                    tertiary: entry.url ? '🔗 URL' : null,
                    detail: entry.password ? '••••••••' : null,
                    actualUrl: entry.url // Store actual URL for launching
                };
            case 'creditCard':
                return {
                    primary: entry.name || entry.title || 'Untitled Card',
                    secondary: entry.cardNumber ? `****${entry.cardNumber.slice(-4)}` : 'No card number',
                    tertiary: `Expires: ${entry.expiry || 'N/A'}`,
                    detail: `CVV: ${entry.cvv ? '•••' : 'Not set'}`,
                    actualUrl: null
                };
            case 'bankAccount':
                return {
                    primary: entry.name || entry.accountHolder || 'Untitled Account',
                    secondary: entry.bankName || 'Bank account',
                    tertiary: entry.accountNumber ? `****${entry.accountNumber.slice(-4)}` : 'No account number',
                    detail: entry.accountType || 'Checking/Savings',
                    actualUrl: null
                };
            case 'contact':
                return {
                    primary: entry.name || entry.title || 'Untitled Address',
                    secondary: entry.addressLine,
                    tertiary: [entry.city, entry.state, entry.zip].filter(Boolean).join(', '),
                    detail: entry.phone || entry.email,
                    actualUrl: null
                };
            case 'driverLicense':
                return {
                    primary: entry.name || entry.title || 'Untitled License',
                    secondary: entry.licenseNumber ? `License: ${entry.licenseNumber}` : 'No license',
                    tertiary: entry.state || 'State not specified',
                    detail: `Expires: ${entry.expiry || 'N/A'}`,
                    actualUrl: null
                };
            default:
                return {
                    primary: entry.name || entry.title || 'Untitled',
                    secondary: entry.username || entry.email,
                    tertiary: null,
                    detail: null,
                    actualUrl: null
                };
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

    const isPasswordCategory = category === 'passwords';

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
                                {entries.map(entry => {
                                    const display = getEntryDisplay(entry);
                                    return (
                                        <div key={entry.id} style={styles.listItem}>
                                            <div style={styles.itemInfo} onClick={() => handleEdit(entry)}>
                                                <div style={styles.itemPrimary}>{display.primary}</div>
                                                {display.secondary && (
                                                    <div style={styles.itemSecondary}>{display.secondary}</div>
                                                )}
                                                {display.tertiary && (
                                                    <div style={styles.itemTertiary}>{display.tertiary}</div>
                                                )}
                                                {display.detail && (
                                                    <div style={styles.itemDetail}>{display.detail}</div>
                                                )}
                                            </div>
                                            <div style={styles.itemActions}>
                                                {isPasswordCategory && entry.url && (
                                                    <>
                                                        <button
                                                            style={styles.launchButton}
                                                            onClick={() => handleLaunch(entry)}
                                                            title="Launch website"
                                                        >
                                                            🌐 Launch
                                                        </button>
                                                        <button
                                                            style={{
                                                                ...styles.autofillToggle,
                                                                background: autofillStatus[entry.id] ? '#2E7D32' : '#4B5563'
                                                            }}
                                                            onClick={() => toggleAutofill(entry.id)}
                                                            title={autofillStatus[entry.id] ? 'Autofill ON - Click to disable' : 'Autofill OFF - Click to enable'}
                                                        >
                                                            {autofillStatus[entry.id] ? '🔓 Auto-fill ON' : '🔒 Auto-fill OFF'}
                                                        </button>
                                                    </>
                                                )}
                                                <button style={styles.editButton} onClick={() => handleEdit(entry)}>
                                                    Edit
                                                </button>
                                                <button style={styles.deleteButton} onClick={() => handleDelete(entry.id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
        maxWidth: '850px',
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
        gap: '1rem',
    },
    itemInfo: {
        flex: 1,
        cursor: 'pointer',
    },
    itemPrimary: {
        fontSize: '0.95rem',
        fontWeight: 600,
        color: '#F3F4F6',
        marginBottom: '4px',
    },
    itemSecondary: {
        fontSize: '0.8rem',
        color: '#9CA3AF',
        marginBottom: '2px',
    },
    itemTertiary: {
        fontSize: '0.75rem',
        color: '#4caf50',
        marginBottom: '2px',
    },
    itemDetail: {
        fontSize: '0.7rem',
        color: '#718096',
        marginTop: '2px',
    },
    itemActions: {
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    launchButton: {
        background: '#3B82F6',
        color: '#fff',
        border: 'none',
        padding: '0.35rem 0.7rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: '500',
        whiteSpace: 'nowrap',
    },
    autofillToggle: {
        color: '#fff',
        border: 'none',
        padding: '0.35rem 0.7rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        transition: 'background 0.2s ease',
    },
    editButton: {
        background: '#ffc107',
        color: '#000',
        border: 'none',
        padding: '0.35rem 0.7rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: '500',
    },
    deleteButton: {
        background: '#dc3545',
        color: '#fff',
        border: 'none',
        padding: '0.35rem 0.7rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.7rem',
        fontWeight: '500',
    },
};