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
    const [copiedField, setCopiedField] = useState(null);

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

    // Copy text to clipboard with feedback
    const copyToClipboard = async (text, fieldName, entryId) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(`${entryId}-${fieldName}`);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopiedField(`${entryId}-${fieldName}`);
            setTimeout(() => setCopiedField(null), 2000);
        }
    };

    // Mask a value (show only first 2 and last 2 characters)
    const maskValue = (value) => {
        if (!value) return '';
        if (value.length <= 4) return '••••••';
        return value.substring(0, 2) + '••••' + value.substring(value.length - 2);
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
            // Copy credentials BEFORE opening browser (avoids focus issues)
            if (autofillStatus[entry.id] && (entry.username || entry.password)) {
                let credentialText = '';
                if (entry.username) credentialText += entry.username;
                if (entry.password) credentialText += (credentialText ? '\n' : '') + entry.password;
                
                // Use fallback method to avoid focus issues
                const textarea = document.createElement('textarea');
                textarea.value = credentialText;
                textarea.style.position = 'fixed';
                textarea.style.top = '-9999px';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            
            // Open URL in external browser
            if (window.api && typeof window.api.openExternal === 'function') {
                await window.api.openExternal(url);
            } else if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
                await window.electronAPI.openExternal(url);
            } else {
                window.open(url, '_blank');
            }
            
            if (autofillStatus[entry.id] && (entry.username || entry.password)) {
                setTimeout(() => {
                    alert(`✓ Website launched!\n\nCredentials copied to clipboard.\nPaste them into the login form.\n\nUsername: ${entry.username || '(not set)'}\nPassword: ${entry.password ? '••••••••' : '(not set)'}`);
                }, 500);
            }
        } catch (err) {
            console.error('Failed to launch URL:', err);
            alert('Failed to open URL: ' + err.message);
        }
    };

    // Toggle autofill for an entry
    const toggleAutofill = (entryId) => {
        const newStatus = { ...autofillStatus, [entryId]: !autofillStatus[entryId] };
        saveAutofillPrefs(newStatus);
    };

    // Helper to get display text for an entry based on category
    const getEntryDisplay = (entry) => {
        // For 'all' category, use the entry's actual type
        const displayType = entryType || entry.type;
        
        switch (displayType) {
            case 'credential':
                return {
                    primary: entry.name || entry.title || 'Untitled',
                    username: entry.username,
                    usernameMasked: maskValue(entry.username),
                    password: entry.password,
                    passwordMasked: '••••••••',
                    url: entry.url,
                    hasUrl: !!entry.url,
                    type: 'credential'
                };
            case 'contact':
                return {
                    primary: entry.name || entry.title || 'Untitled Address',
                    address: entry.addressLine,
                    cityState: [entry.city, entry.state, entry.zip].filter(Boolean).join(', '),
                    contact: entry.phone || entry.email,
                    type: 'contact'
                };
            case 'creditCard':
                return {
                    primary: entry.name || entry.title || 'Untitled Card',
                    cardNumber: entry.cardNumber ? `****${entry.cardNumber.slice(-4)}` : 'No card number',
                    expiry: `Expires: ${entry.expiry || 'N/A'}`,
                    cvv: entry.cvv ? '•••' : null,
                    type: 'creditCard'
                };
            case 'bankAccount':
                return {
                    primary: entry.name || entry.accountHolder || 'Untitled Account',
                    bankName: entry.bankName || 'Bank account',
                    accountNumber: entry.accountNumber ? `****${entry.accountNumber.slice(-4)}` : 'No account number',
                    accountType: entry.accountType || 'Checking/Savings',
                    type: 'bankAccount'
                };
            case 'driverLicense':
                return {
                    primary: entry.name || entry.title || 'Untitled License',
                    licenseNumber: entry.licenseNumber ? maskValue(entry.licenseNumber) : 'No license',
                    state: entry.state || 'State not specified',
                    expiry: `Expires: ${entry.expiry || 'N/A'}`,
                    type: 'driverLicense'
                };
            default:
                return {
                    primary: entry.name || entry.title || 'Untitled',
                    secondary: entry.username || entry.email,
                    type: 'unknown'
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
                                    const isCredential = display.type === 'credential';
                                    
                                    return (
                                        <div key={entry.id} style={styles.listItem}>
                                            <div style={styles.itemInfo} onClick={() => handleEdit(entry)}>
                                                <div style={styles.itemPrimary}>{display.primary}</div>
                                                
                                                {isCredential && (
                                                    <>
                                                        {display.username && (
                                                            <div style={styles.copyableRow}>
                                                                <span style={styles.fieldLabel}>Username:</span>
                                                                <span 
                                                                    style={styles.copyableValue}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyToClipboard(display.username, 'username', entry.id);
                                                                    }}
                                                                    title="Click to copy username"
                                                                >
                                                                    {display.usernameMasked}
                                                                    {copiedField === `${entry.id}-username` && (
                                                                        <span style={styles.copiedIndicator}> ✓ Copied!</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {display.password && (
                                                            <div style={styles.copyableRow}>
                                                                <span style={styles.fieldLabel}>Password:</span>
                                                                <span 
                                                                    style={styles.copyableValue}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyToClipboard(display.password, 'password', entry.id);
                                                                    }}
                                                                    title="Click to copy password"
                                                                >
                                                                    {display.passwordMasked}
                                                                    {copiedField === `${entry.id}-password` && (
                                                                        <span style={styles.copiedIndicator}> ✓ Copied!</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {display.url && (
                                                            <div style={styles.itemUrl}>🔗 URL</div>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {display.type === 'contact' && (
                                                    <>
                                                        {display.address && <div style={styles.itemSecondary}>{display.address}</div>}
                                                        {display.cityState && <div style={styles.itemTertiary}>{display.cityState}</div>}
                                                        {display.contact && <div style={styles.itemDetail}>{display.contact}</div>}
                                                    </>
                                                )}
                                                
                                                {display.type === 'creditCard' && (
                                                    <>
                                                        <div style={styles.itemSecondary}>{display.cardNumber}</div>
                                                        <div style={styles.itemTertiary}>{display.expiry}</div>
                                                        {display.cvv && <div style={styles.itemDetail}>CVV: {display.cvv}</div>}
                                                    </>
                                                )}
                                                
                                                {display.type === 'bankAccount' && (
                                                    <>
                                                        <div style={styles.itemSecondary}>{display.bankName}</div>
                                                        <div style={styles.itemTertiary}>{display.accountNumber}</div>
                                                        <div style={styles.itemDetail}>{display.accountType}</div>
                                                    </>
                                                )}
                                                
                                                {display.type === 'driverLicense' && (
                                                    <>
                                                        <div style={styles.itemSecondary}>License: {display.licenseNumber}</div>
                                                        <div style={styles.itemTertiary}>{display.state}</div>
                                                        <div style={styles.itemDetail}>{display.expiry}</div>
                                                    </>
                                                )}
                                            </div>
                                            
                                            <div style={styles.itemActions}>
                                                {isCredential && display.url && (
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
        flexWrap: 'wrap',
    },
    itemInfo: {
        flex: 1,
        cursor: 'pointer',
        minWidth: '200px',
    },
    itemPrimary: {
        fontSize: '0.95rem',
        fontWeight: 600,
        color: '#F3F4F6',
        marginBottom: '6px',
    },
    copyableRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
        fontSize: '0.8rem',
        flexWrap: 'wrap',
    },
    fieldLabel: {
        color: '#9CA3AF',
        minWidth: '70px',
    },
    copyableValue: {
        color: '#C8E6C9',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: '4px',
        transition: 'background 0.2s ease',
        fontFamily: "'Monaco', 'Menlo', monospace",
        ':hover': {
            background: 'rgba(76, 175, 80, 0.2)',
        },
    },
    copiedIndicator: {
        color: '#10B981',
        fontSize: '0.7rem',
        marginLeft: '6px',
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
    itemUrl: {
        fontSize: '0.7rem',
        color: '#60A5FA',
        marginTop: '4px',
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