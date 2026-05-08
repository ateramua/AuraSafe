// src/components/PasswordsModal.jsx
import { useState, useEffect } from 'react';
import EntryModal from './EntryModal';
import TOTPDisplay from './TOTPDisplay';

export default function PasswordsModal({ isOpen, onClose, api }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [copiedField, setCopiedField] = useState(null);
  const [showPassword, setShowPassword] = useState({});
  const [autoFillEnabled, setAutoFillEnabled] = useState({});
  const [fillStatus, setFillStatus] = useState({});

  // Helper function to get website name from URL
  const getWebsiteName = (url) => {
    if (!url) return 'Website';
    try {
      let domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
      domain = domain.split('/')[0];
      const parts = domain.split('.');
      if (parts.length >= 2) {
        return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
      }
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return 'Website';
    }
  };

  // IMPROVED setFieldValue - Fixes React/Vue/Angular forms
  const setFieldValue = (field, value) => {
    if (!field) return;

    const prototype = Object.getPrototypeOf(field);
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    field.focus();

    if (valueSetter) {
      valueSetter.call(field, value);
    } else {
      field.value = value;
    }

    field.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: value
    }));

    field.dispatchEvent(new Event('change', { bubbles: true }));

    field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    field.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Tab' }));

    field.blur();
  };

  // ===================== DIRECT FILL VIA EXTENSION =====================
  const showNotification = (message, isError = false) => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${isError ? '#EF4444' : '#10B981'};
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      z-index: 100000;
      font-size: 13px;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const fillCredentialsDirectly = async (entry, fillType = 'both') => {
    if (!entry) {
      showNotification('No entry selected', true);
      return;
    }

    setFillStatus(prev => ({ ...prev, [entry.id]: 'filling' }));
    
    try {
      // Detect which browser API is available
      let runtime = null;
      let tab = null;
      
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
        runtime = chrome;
      } else if (typeof browser !== 'undefined' && browser.tabs && browser.runtime) {
        runtime = browser;
      } else {
        throw new Error('No browser extension API found');
      }
      
      // ✅ NEW: Use stored tab ID from launch instead of active tab
      const { lastOpenedTabId, lastEntry } = await runtime.storage.local.get(['lastOpenedTabId', 'lastEntry']);
      
      // Check if we have a valid stored tab
      if (lastOpenedTabId && lastEntry && lastEntry.id === entry.id) {
        try {
          // Verify tab still exists
          const tab = await runtime.tabs.get(lastOpenedTabId);
          if (tab && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            console.log('[AuraSafe] Using stored tab from launch:', lastOpenedTabId, tab.url);
            tab.id = lastOpenedTabId;
          } else {
            throw new Error('Tab invalid');
          }
        } catch (e) {
          console.log('[AuraSafe] Stored tab no longer valid, falling back to active tab');
          tab = null;
        }
      }
      
      // FALLBACK: If no stored tab, try active tab in current window
      if (!tab?.id) {
        try {
          const tabs = await runtime.tabs.query({ active: true, currentWindow: true });
          tab = tabs?.[0];
          
          if (tab?.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            console.log('[AuraSafe] Found active webpage tab:', tab.id, tab.url);
          } else {
            tab = null;
          }
        } catch (e) {
          console.warn('[AuraSafe] Could not get active tab:', e);
          tab = null;
        }
      }
      
      // SECOND FALLBACK: Scan all tabs for any http/https page
      if (!tab?.id) {
        console.log('[AuraSafe] No active webpage tab, scanning all tabs...');
        const allTabs = await runtime.tabs.query({});
        tab = allTabs.find(t =>
          t.url &&
          (t.url.startsWith('http://') || t.url.startsWith('https://'))
        );
        
        if (tab) {
          console.log('[AuraSafe] Found webpage tab in fallback:', tab.id, tab.url);
        }
      }
      
      // Validate tab
      if (!tab?.id) {
        throw new Error('INVALID_TAB');
      }
      
      // Ensure content script is available
      try {
        await runtime.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (e) {
        console.warn('Script already injected or failed:', e);
      }
      
      // Prepare the message
      let messageType = 'FILL_BOTH';
      let payload = { 
        username: entry.username || entry.email || '', 
        password: entry.password || '' 
      };
      
      if (fillType === 'username') {
        messageType = 'FILL_USERNAME';
        payload = { username: entry.username || entry.email || '' };
      } else if (fillType === 'password') {
        messageType = 'FILL_PASSWORD';
        payload = { password: entry.password || '' };
      }
      
      console.log('[AuraSafe] Sending fill message to tab:', tab.id, messageType, payload);
      
      // Send message to content script
      const response = await runtime.tabs.sendMessage(tab.id, { type: messageType, payload });
      
      console.log('[AuraSafe] Fill response:', response);
      
      if (response && response.success) {
        setFillStatus(prev => ({ ...prev, [entry.id]: 'success' }));
        showNotification('✓ Credentials filled successfully!');
        setTimeout(() => setFillStatus(prev => ({ ...prev, [entry.id]: null })), 2000);
      } else {
        throw new Error(response?.error || 'Content script did not confirm fill');
      }
      
    } catch (err) {
      console.error('[AuraSafe] Fill failed:', err);
      setFillStatus(prev => ({ ...prev, [entry.id]: 'error' }));
      
      let errorMessage;
      if (err.message === 'INVALID_TAB') {
        errorMessage = 'No webpage found. Click Launch first to open the website.';
      } else if (err.message?.includes('Receiving end does not exist') || err.message?.includes('Could not establish connection')) {
        errorMessage = 'Reload the webpage and try again.';
      } else {
        errorMessage = 'Autofill failed. Click Launch to open the website first.';
      }
      
      showNotification(errorMessage, true);
      setTimeout(() => setFillStatus(prev => ({ ...prev, [entry.id]: null })), 3000);
    }
  };

  const getFillButtonText = (entryId) => {
    const status = fillStatus[entryId];
    if (status === 'filling') return '⏳ Filling...';
    if (status === 'success') return '✓ Filled!';
    if (status === 'error') return '❌ Failed';
    return '🔓 Fill';
  };

  const fetchEntries = async () => {
    if (!api) return;
    setLoading(true);
    try {
      const all = (await api.getVaultEntries()) || [];
      console.log('[PasswordsModal] All entries:', all.length);
      // Filter for credential type only using category field
      const filtered = all.filter(e => e.category === 'credential');
      console.log('[PasswordsModal] Filtered passwords:', filtered.length);
      setEntries(filtered);
      
      // Load auto-fill preferences
      const savedAutoFill = localStorage.getItem('aurasafe_autofill_prefs');
      const autoFillPrefs = savedAutoFill ? JSON.parse(savedAutoFill) : {};
      setAutoFillEnabled(autoFillPrefs);
    } catch (err) {
      console.error('[PasswordsModal] Error fetching entries:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('[PasswordsModal] Modal opened, fetching entries...');
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
      // Ensure category is set to credential for passwords
      const saveData = { ...entryData, category: 'credential', type: 'credential' };
      await api.saveVaultEntry(saveData);
      setShowEntryModal(false);
      setEditingEntry(null);
      await fetchEntries(); // Refresh the list
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

  const copyUrlToClipboard = async (url, entryId) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedField(`url_${entryId}`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // ✅ UPDATED: Modified launchWebsite function to store tab reference
  const launchWebsite = async (url, entryId) => {
    if (!url) return;
    
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }
    
    // Get the entry for storage
    const entry = entries.find(e => e.id === entryId);
    
    // Detect which browser API is available
    let runtime = null;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      runtime = chrome;
    } else if (typeof browser !== 'undefined' && browser.tabs && browser.runtime) {
      runtime = browser;
    }
    
    // Use Electron's shell.openExternal to open in system default browser
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        await window.electronAPI.openExternal(finalUrl);
        
        // For Electron desktop app, store pending autofill
        if (autoFillEnabled[entryId] && entry && (entry.username || entry.email)) {
          try {
            await window.electronAPI.setPendingAutofill({
              entryId: entry.id,
              username: entry.username || entry.email || '',
              password: entry.password || '',
              url: finalUrl,
              timestamp: Date.now()
            });
            console.log('[AuraSafe] Pending autofill sent via electronAPI');
          } catch (err) {
            console.error('[AuraSafe] Failed to set pending autofill:', err);
          }
        }
      } else if (runtime) {
        // ✅ CRITICAL FIX: Create tab and store reference for browser extension
        const tab = await runtime.tabs.create({ url: finalUrl });
        
        // Store the tab ID and entry for autofill
        await runtime.storage.local.set({
          lastOpenedTabId: tab.id,
          lastEntry: entry,
          lastOpenedUrl: finalUrl
        });
        
        console.log('[AuraSafe] Stored tab reference for autofill:', tab.id);
        
        // Show success notification
        const notification = document.createElement('div');
        notification.textContent = '✓ Website launched! Use "Fill" button to autofill credentials.';
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
        setTimeout(() => notification.remove(), 3000);
      } else {
        console.warn('No browser API available, using window.open');
        window.open(finalUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to launch external browser:', err);
      window.open(finalUrl, '_blank');
    }
  };

  const togglePasswordVisibility = (id, e) => {
    e.stopPropagation();
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskPassword = (password) => {
    if (!password) return '';
    if (password.length <= 4) return '•'.repeat(password.length);
    return '•'.repeat(8);
  };

  const maskUsername = (username) => {
    if (!username) return '';
    if (username.length <= 4) return username;
    return username.substring(0, 2) + '•'.repeat(Math.min(username.length - 4, 6)) + username.substring(username.length - 2);
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
    if (window.confirm(`Delete ${selectedIds.length} password(s)?`)) {
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
              <h2 style={styles.titleText}>🔐 Passwords</h2>
              {entries.length > 0 && <span style={styles.countBadge}>{entries.length} items</span>}
            </div>
            <div style={styles.headerActions}>
              <button onClick={handleAdd} style={styles.addBtn}>+ Add Password</button>
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
              <p style={styles.loading}>Loading passwords...</p>
            ) : entries.length === 0 ? (
              <p style={styles.empty}>No passwords yet. Click "Add Password" to create one.</p>
            ) : (
              entries.map(entry => (
                <div key={entry.id} style={styles.item}>
                  <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggleSelectOne(entry.id)} style={styles.checkbox} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.itemTitle}>{entry.title || 'Untitled'}</div>
                    <div style={styles.subText}>
                      {entry.username && (
                        <span style={styles.copyableField} onClick={() => copyToClipboard(entry.username, 'username', entry.id)}>
                          👤 {maskUsername(entry.username)}
                          {copiedField === `username_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                      )}
                      {entry.password && (
                        <span style={styles.passwordWrapper}>
                          <span style={styles.copyableField} onClick={() => copyToClipboard(entry.password, 'password', entry.id)}>
                            🔒 {showPassword[entry.id] ? entry.password : maskPassword(entry.password)}
                          </span>
                          <button onClick={(e) => togglePasswordVisibility(entry.id, e)} style={styles.eyeButton}>
                            {showPassword[entry.id] ? '🙈' : '👁️'}
                          </button>
                          {copiedField === `password_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                        </span>
                      )}
                      {/* URL field - Now shows generic "URL" text instead of the actual URL */}
                      {entry.url && (
                        <span style={styles.urlFieldWrapper}>
                          <span
                            style={styles.urlLink}
                            onClick={() => copyUrlToClipboard(entry.url, entry.id)}
                            title={`Click to copy URL: ${entry.url}`}
                          >
                            🔗 URL
                          </span>
                          {copiedField === `url_${entry.id}` && <span style={styles.copiedIndicator}> ✓ Copied!</span>}
                          <button
                            onClick={() => launchWebsite(entry.url, entry.id)}
                            style={styles.launchBtn}
                            title={`Launch ${getWebsiteName(entry.url)}`}
                          >
                            Launch
                          </button>
                        </span>
                      )}
                    </div>
                    {entry.totpSecret && (
                      <div style={{ marginTop: '8px' }}>
                        <TOTPDisplay secret={entry.totpSecret} label="2FA Code" />
                      </div>
                    )}
                  </div>
                  <div style={styles.actionButtons}>
                    <button
                      onClick={() => fillCredentialsDirectly(entry, 'both')}
                      style={styles.fillBtn}
                      disabled={fillStatus[entry.id] === 'filling'}
                    >
                      {getFillButtonText(entry.id)}
                    </button>
                    <button onClick={() => handleEdit(entry)} style={styles.editBtn}>Edit</button>
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
        category="passwords"
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
  passwordWrapper: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  eyeButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', borderRadius: '4px' },
  urlFieldWrapper: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  urlLink: { color: '#60A5FA', cursor: 'pointer', fontSize: '12px' },
  launchBtn: { background: '#3B82F6', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', transition: 'all 0.2s ease' },
  copiedIndicator: { color: '#10B981', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' },
  actionButtons: { display: 'flex', gap: '6px', alignItems: 'center' },
  fillBtn: { background: '#10B981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500', transition: 'all 0.2s ease', minWidth: '75px' },
  editBtn: { background: '#8B5CF6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' },
  loading: { textAlign: 'center', padding: '2rem', color: '#c8e6c9' },
  empty: { textAlign: 'center', padding: '2rem', color: '#c8e6c9', fontStyle: 'italic' },
};