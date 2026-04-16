// src/components/ProfileManager.jsx
import { useState, useEffect } from 'react';

export default function ProfileManager({ onProfilesUpdate }) {
    const [profiles, setProfiles] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [vaultUnlocked, setVaultUnlocked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        id: '',
        type: 'identity',
        name: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        company: '',
        jobTitle: '',
        birthDate: ''
    });

    // Check vault status
    const checkVaultUnlocked = async () => {
        try {
            if (window.electronAPI) {
                const unlocked = await window.electronAPI.isUnlocked();
                setVaultUnlocked(unlocked);
                if (unlocked) {
                    await loadProfiles();
                }
            }
        } catch (err) {
            console.error('Failed to check vault status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkVaultUnlocked();
    }, []);

    const loadProfiles = async () => {
        try {
            if (window.electronAPI && vaultUnlocked) {
                const entries = await window.electronAPI.getVaultEntries();
                const identityEntries = entries.filter(e => e.type === 'identity');
                setProfiles(identityEntries);
                
                // 🔥 NEW: Notify parent component or extension that profiles have been updated
                if (onProfilesUpdate) {
                    onProfilesUpdate(identityEntries);
                }
                
                // 🔥 NEW: Also notify the browser extension via WebSocket
                if (window.electronAPI && window.electronAPI.notifyExtensionProfilesUpdated) {
                    await window.electronAPI.notifyExtensionProfilesUpdated(identityEntries);
                }
            }
        } catch (err) {
            console.error('Failed to load profiles:', err);
            if (err.message.includes('locked')) {
                setVaultUnlocked(false);
            }
        }
    };

    const handleSave = async () => {
        try {
            if (!vaultUnlocked) {
                alert('Please unlock your vault first');
                return;
            }

            // Validate required fields
            if (!formData.name.trim()) {
                alert('Please enter a profile name');
                return;
            }

            const id = editingProfile?.id || Date.now().toString();
            const profile = { ...formData, id, type: 'identity' };

            const entries = await window.electronAPI.getVaultEntries();
            const index = entries.findIndex(e => e.id === id);

            if (index !== -1) entries[index] = profile;
            else entries.push(profile);

            await window.electronAPI.saveVaultEntries(entries);
            await loadProfiles();
            resetForm();
            
            // 🔥 NEW: Show success message
            alert(`✅ Profile "${profile.name}" saved successfully!`);
        } catch (err) {
            console.error('Failed to save profile:', err);
            alert('Failed to save profile: ' + err.message);
        }
    };

    const handleDelete = async (id, name) => {
        if (!vaultUnlocked) {
            alert('Please unlock your vault first');
            return;
        }

        if (!confirm(`Delete profile "${name}"? This action cannot be undone.`)) return;

        try {
            const entries = await window.electronAPI.getVaultEntries();
            const filtered = entries.filter(e => e.id !== id);
            await window.electronAPI.saveVaultEntries(filtered);
            await loadProfiles();
            alert(`✅ Profile "${name}" deleted successfully`);
        } catch (err) {
            console.error('Failed to delete profile:', err);
            alert('Failed to delete profile: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            id: '',
            type: 'identity',
            name: '',
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            zipCode: '',
            country: '',
            company: '',
            jobTitle: '',
            birthDate: ''
        });
        setEditingProfile(null);
        setShowForm(false);
    };

    const handleEdit = (profile) => {
        setEditingProfile(profile);
        setFormData(profile);
        setShowForm(true);
    };

    // 🔥 NEW: Copy profile data to clipboard
    const copyProfileData = (profile) => {
        const profileText = `
Name: ${profile.firstName} ${profile.lastName}
Email: ${profile.email}
Phone: ${profile.phone}
Address: ${profile.address}, ${profile.city}, ${profile.state} ${profile.zipCode}
Company: ${profile.company}
Job Title: ${profile.jobTitle}
        `.trim();
        
        navigator.clipboard.writeText(profileText);
        alert('✅ Profile data copied to clipboard');
    };

    // 🔥 NEW: Export all profiles as JSON
    const exportProfiles = () => {
        const dataStr = JSON.stringify(profiles, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `aurasafe-profiles-${new Date().toISOString().slice(0,19)}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    // 🔥 NEW: Import profiles from JSON
    const importProfiles = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedProfiles = JSON.parse(e.target.result);
                if (!Array.isArray(importedProfiles)) {
                    alert('Invalid file format. Expected an array of profiles.');
                    return;
                }
                
                const entries = await window.electronAPI.getVaultEntries();
                const existingIdentities = entries.filter(e => e.type !== 'identity');
                const newEntries = [...existingIdentities, ...importedProfiles];
                
                await window.electronAPI.saveVaultEntries(newEntries);
                await loadProfiles();
                alert(`✅ Imported ${importedProfiles.length} profiles successfully!`);
            } catch (err) {
                console.error('Failed to import profiles:', err);
                alert('Failed to import profiles: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    // 🔥 NEW: Filter profiles by search term
    const filteredProfiles = profiles.filter(profile =>
        profile.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        profile.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <div style={styles.container}>Checking vault status...</div>;
    }

    if (!vaultUnlocked) {
        return (
            <div style={styles.container}>
                <div style={styles.lockedMessage}>
                    🔒 Vault is locked
                    <p>Please unlock your vault to manage profiles.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3>📝 My Profiles</h3>
                <div style={styles.headerButtons}>
                    <button onClick={exportProfiles} style={styles.exportButton}>
                        📤 Export
                    </button>
                    <label style={styles.importButton}>
                        📥 Import
                        <input
                            type="file"
                            accept=".json"
                            onChange={importProfiles}
                            style={{ display: 'none' }}
                        />
                    </label>
                    <button onClick={() => setShowForm(true)} style={styles.addButton}>
                        + Add Profile
                    </button>
                </div>
            </div>

            {/* 🔥 NEW: Search Bar */}
            {profiles.length > 0 && (
                <div style={styles.searchContainer}>
                    <input
                        type="text"
                        placeholder="🔍 Search profiles..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
            )}

            {showForm && (
                <div style={styles.formModal} onClick={() => setShowForm(false)}>
                    <div style={styles.formContent} onClick={e => e.stopPropagation()}>
                        <div style={styles.formHeader}>
                            <h4>{editingProfile ? 'Edit Profile' : 'New Profile'}</h4>
                            <button onClick={resetForm} style={styles.formCloseButton}>×</button>
                        </div>

                        <div style={styles.formBody}>
                            <input
                                type="text"
                                placeholder="Profile Name *"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                style={styles.input}
                                required
                            />

                            <div style={styles.row}>
                                <input
                                    type="text"
                                    placeholder="First Name"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    style={styles.input}
                                />
                                <input
                                    type="text"
                                    placeholder="Last Name"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <input
                                type="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={styles.input}
                            />

                            <input
                                type="tel"
                                placeholder="Phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                style={styles.input}
                            />

                            <input
                                type="text"
                                placeholder="Street Address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                style={styles.input}
                            />

                            <div style={styles.row}>
                                <input
                                    type="text"
                                    placeholder="City"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    style={styles.input}
                                />
                                <input
                                    type="text"
                                    placeholder="State"
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    style={styles.input}
                                />
                                <input
                                    type="text"
                                    placeholder="ZIP"
                                    value={formData.zipCode}
                                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                    style={styles.input}
                                />
                            </div>

                            <input
                                type="text"
                                placeholder="Country"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                style={styles.input}
                            />

                            <input
                                type="text"
                                placeholder="Company"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                style={styles.input}
                            />

                            <input
                                type="text"
                                placeholder="Job Title"
                                value={formData.jobTitle}
                                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                style={styles.input}
                            />

                            <div style={styles.buttons}>
                                <button onClick={resetForm} style={styles.cancelButton}>Cancel</button>
                                <button onClick={handleSave} style={styles.saveButton}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={styles.profilesList}>
                {filteredProfiles.length === 0 ? (
                    <div style={styles.emptyState}>
                        {searchTerm ? 'No matching profiles found.' : 'No profiles yet. Click "Add Profile" to create one.'}
                    </div>
                ) : (
                    filteredProfiles.map(profile => (
                        <div key={profile.id} style={styles.profileCard}>
                            <div style={styles.profileHeader}>
                                <strong>👤 {profile.name}</strong>
                                <div style={styles.profileActions}>
                                    <button onClick={() => copyProfileData(profile)} style={styles.copyButton} title="Copy profile data">
                                        📋
                                    </button>
                                    <button onClick={() => handleEdit(profile)} style={styles.editButton} title="Edit">
                                        ✏️
                                    </button>
                                    <button onClick={() => handleDelete(profile.id, profile.name)} style={styles.deleteButton} title="Delete">
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            <div style={styles.profileDetails}>
                                {profile.firstName || profile.lastName ? (
                                    <div>📛 {profile.firstName} {profile.lastName}</div>
                                ) : null}
                                {profile.email && <div>📧 {profile.email}</div>}
                                {profile.phone && <div>📞 {profile.phone}</div>}
                                {(profile.address || profile.city || profile.state || profile.zipCode) && (
                                    <div>📍 {[profile.address, profile.city, profile.state, profile.zipCode].filter(Boolean).join(', ')}</div>
                                )}
                                {(profile.company || profile.jobTitle) && (
                                    <div>💼 {[profile.company, profile.jobTitle].filter(Boolean).join(' - ')}</div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 🔥 NEW: Tips section */}
            <div style={styles.tipsSection}>
                <div style={styles.tipsTitle}>💡 Tips</div>
                <ul style={styles.tipsList}>
                    <li>Profiles are synced with your browser extension for autofill</li>
                    <li>Create multiple profiles (e.g., "Personal", "Work") for different scenarios</li>
                    <li>Fields left blank will not be filled by the extension</li>
                    <li>Export your profiles as backup or to share between devices</li>
                </ul>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '1rem' },
    lockedMessage: {
        textAlign: 'center',
        padding: '2rem',
        color: '#F87171',
        background: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '0.5rem'
    },
    header: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
    },
    headerButtons: {
        display: 'flex',
        gap: '0.5rem'
    },
    addButton: { 
        background: '#10B981', 
        color: 'white', 
        border: 'none', 
        padding: '0.5rem 1rem', 
        borderRadius: '0.5rem', 
        cursor: 'pointer' 
    },
    exportButton: {
        background: '#3B82F6',
        color: 'white',
        border: 'none',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        cursor: 'pointer'
    },
    importButton: {
        background: '#8B5CF6',
        color: 'white',
        border: 'none',
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        display: 'inline-block'
    },
    searchContainer: {
        marginBottom: '1rem'
    },
    searchInput: {
        width: '100%',
        padding: '0.5rem',
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '0.5rem',
        color: 'white',
        fontSize: '0.875rem'
    },
    formModal: { 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.8)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000 
    },
    formContent: { 
        background: '#1F2937', 
        borderRadius: '1rem', 
        width: '500px', 
        maxHeight: '85vh', 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    },
    formHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #374151'
    },
    formBody: {
        padding: '1rem',
        overflowY: 'auto'
    },
    formCloseButton: {
        background: 'none',
        border: 'none',
        color: '#9CA3AF',
        fontSize: '1.5rem',
        cursor: 'pointer'
    },
    input: { 
        width: '100%', 
        padding: '0.5rem', 
        marginBottom: '0.5rem', 
        background: '#111827', 
        border: '1px solid #374151', 
        borderRadius: '0.5rem', 
        color: 'white' 
    },
    row: { display: 'flex', gap: '0.5rem' },
    buttons: { display: 'flex', gap: '1rem', marginTop: '1rem' },
    saveButton: { flex: 1, background: '#10B981', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer' },
    cancelButton: { flex: 1, background: '#4B5563', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer' },
    profilesList: { display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto' },
    profileCard: { background: '#111827', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #374151' },
    profileHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #374151' },
    profileActions: { display: 'flex', gap: '0.5rem' },
    profileDetails: { fontSize: '0.875rem', color: '#9CA3AF' },
    copyButton: { background: '#3B82F6', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' },
    editButton: { background: '#F59E0B', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer', marginRight: '0.25rem' },
    deleteButton: { background: '#EF4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', cursor: 'pointer' },
    emptyState: { textAlign: 'center', padding: '2rem', color: '#9CA3AF' },
    tipsSection: {
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '0.5rem',
        border: '1px solid rgba(59, 130, 246, 0.3)'
    },
    tipsTitle: {
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#60A5FA',
        marginBottom: '0.5rem'
    },
    tipsList: {
        margin: 0,
        paddingLeft: '1.25rem',
        fontSize: '0.7rem',
        color: '#9CA3AF'
    }
};