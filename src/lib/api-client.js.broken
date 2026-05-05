// src/lib/api-client.js
// AuraSafe API Client - Bridge between React components and Electron main process
// Version: 1.0.0

// ===================== CONFIGURATION =====================

/**
 * Check if running in Electron environment
 */
const isElectron = typeof window !== 'undefined' && !!window.api;

/**
 * API endpoint availability cache
 */
const apiCache = {
  checked: false,
  available: {},
  lastCheck: 0,
  CHECK_INTERVAL: 5000, // 5 seconds
};

/**
 * Check if a specific API method is available
 */
function isApiMethodAvailable(methodName) {
  const now = Date.now();
  if (!apiCache.checked || (now - apiCache.lastCheck) > apiCache.CHECK_INTERVAL) {
    apiCache.available = {
      getVaultEntries: !!window.api?.getVaultEntries,
      saveVaultEntry: !!window.api?.saveVaultEntry,
      deleteVaultEntry: !!window.api?.deleteVaultEntry,
      isInitialized: !!window.api?.isInitialized,
      isUnlocked: !!window.api?.isUnlocked,
      unlockVault: !!window.api?.unlockVault,
      initVault: !!window.api?.initVault,
      lockVault: !!window.api?.lockVault,
      changePassword: !!window.api?.changePassword,
      generatePairingCode: !!window.api?.generatePairingCode,
      verifyPairingCode: !!window.api?.verifyPairingCode,
      biometric: !!window.api?.biometric,
      sync: !!window.api?.sync,
      settings: !!window.api?.settings,
    };
    apiCache.checked = true;
    apiCache.lastCheck = now;
  }
  return apiCache.available[methodName] || false;
}

/**
 * Handle API errors consistently
 */
function handleApiError(methodName, error, context = {}) {
  console.error(`[API Error] ${methodName}:`, {
    message: error.message,
    stack: error.stack,
    ...context,
  });
  
  // Re-throw with user-friendly message
  const userMessage = error.message || `Failed to ${methodName.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  throw new Error(userMessage);
}

/**
 * Ensure Electron environment before API call
 */
function ensureElectron() {
  if (!isElectron) {
    throw new Error('Not running in Electron environment. This API is only available in the desktop app.');
  }
}

// ===================== VAULT CRUD OPERATIONS =====================

/**
 * Get all vault entries
 * @returns {Promise<Array>} Array of vault entries
 */
export async function getVaultEntries() {
  try {
    ensureElectron();
    
    if (!isApiMethodAvailable('getVaultEntries')) {
      throw new Error('getVaultEntries API is not available. Please ensure the app is properly initialized.');
    }

    const entries = await window.api.getVaultEntries();
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    handleApiError('getVaultEntries', error);
    return []; // Return empty array as fallback
  }
}

/**
 * Save a vault entry (creates or updates)
 * @param {Object} entry - The entry to save
 * @param {string} entry.id - Optional ID for existing entry
 * @param {string} entry.type - Entry type (credential, contact, etc.)
 * @param {string} entry.title - Entry title/name
 * @returns {Promise<Object>} The saved entry
 */
export async function saveVaultEntry(entry) {
  try {
    ensureElectron();
    
    if (!entry) {
      throw new Error('No entry provided');
    }
    
    if (!isApiMethodAvailable('saveVaultEntry')) {
      throw new Error('saveVaultEntry API is not available');
    }

    // Validate required fields
    if (!entry.title && !entry.name) {
      throw new Error('Entry must have a title or name');
    }

    // Normalize entry data
    const normalizedEntry = {
      ...entry,
      title: entry.title || entry.name || 'Untitled Entry',
      updated_at: Date.now(),
    };

    // Add created_at for new entries
    if (!entry.id) {
      normalizedEntry.created_at = Date.now();
    }

    const savedEntry = await window.api.saveVaultEntry(normalizedEntry);
    return savedEntry;
  } catch (error) {
    handleApiError('saveVaultEntry', error, { entryId: entry?.id });
  }
}

/**
 * Delete a vault entry by ID
 * @param {string} id - The entry ID to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteVaultEntry(id) {
  try {
    ensureElectron();
    
    if (!id) {
      throw new Error('No entry ID provided');
    }
    
    if (!isApiMethodAvailable('deleteVaultEntry')) {
      throw new Error('deleteVaultEntry API is not available');
    }

    const result = await window.api.deleteVaultEntry(id);
    return result?.success === true;
  } catch (error) {
    handleApiError('deleteVaultEntry', error, { entryId: id });
  }
}

// ===================== COMPATIBILITY HELPERS =====================

/**
 * Add a new vault entry (alias for saveVaultEntry)
 * @param {Object} entry - The entry to add
 * @returns {Promise<Object>} The added entry
 */
export async function addVaultEntry(entry) {
  return saveVaultEntry(entry);
}

/**
 * Update an existing vault entry (alias for saveVaultEntry)
 * @param {string} id - The entry ID
 * @param {Object} entry - The updated entry data
 * @returns {Promise<Object>} The updated entry
 */
export async function updateVaultEntry(id, entry) {
  return saveVaultEntry({ ...entry, id });
}

/**
 * Load all vault entries (alias for getVaultEntries)
 * @returns {Promise<Array>} Array of vault entries
 */
export const loadVault = getVaultEntries;

// ===================== VAULT STATE OPERATIONS =====================

/**
 * Check if vault is initialized
 * @returns {Promise<boolean>}
 */
export async function isInitialized() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('isInitialized')) return false;
    
    const result = await window.api.isInitialized();
    return result?.initialized === true;
  } catch (error) {
    console.error('[API] isInitialized error:', error);
    return false;
  }
}

/**
 * Check if vault is unlocked
 * @returns {Promise<boolean>}
 */
export async function isUnlocked() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('isUnlocked')) return false;
    
    const result = await window.api.isUnlocked();
    return result?.unlocked === true;
  } catch (error) {
    console.error('[API] isUnlocked error:', error);
    return false;
  }
}

/**
 * Unlock the vault with master password
 * @param {string} password - Master password
 * @returns {Promise<Object>} Result with success flag and entries
 */
export async function unlockVault(password) {
  try {
    ensureElectron();
    
    if (!password || password.length === 0) {
      throw new Error('Password is required');
    }
    
    if (!isApiMethodAvailable('unlockVault')) {
      throw new Error('unlockVault API is not available');
    }
    
    const result = await window.api.unlockVault(password);
    return result;
  } catch (error) {
    handleApiError('unlockVault', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize a new vault
 * @param {string} password - Master password for new vault
 * @returns {Promise<boolean>}
 */
export async function initVault(password) {
  try {
    ensureElectron();
    
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    if (!isApiMethodAvailable('initVault')) {
      throw new Error('initVault API is not available');
    }
    
    const result = await window.api.initVault(password);
    return result?.success === true;
  } catch (error) {
    handleApiError('initVault', error);
    return false;
  }
}

/**
 * Lock the vault
 * @returns {Promise<boolean>}
 */
export async function lockVault() {
  try {
    if (!isElectron) return true;
    if (!isApiMethodAvailable('lockVault')) return true;
    
    const result = await window.api.lockVault();
    return result?.success === true;
  } catch (error) {
    console.error('[API] lockVault error:', error);
    return true; // Assume success on error
  }
}

/**
 * Change master password
 * @param {string} currentPassword - Current master password
 * @param {string} newPassword - New master password
 * @returns {Promise<Object>}
 */
export async function changePassword(currentPassword, newPassword) {
  try {
    ensureElectron();
    
    if (!currentPassword || !newPassword) {
      throw new Error('Both current and new passwords are required');
    }
    
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }
    
    if (!isApiMethodAvailable('changePassword')) {
      throw new Error('changePassword API is not available');
    }
    
    const result = await window.api.changePassword(currentPassword, newPassword);
    return result;
  } catch (error) {
    handleApiError('changePassword', error);
    return { success: false, error: error.message };
  }
}

// ===================== BROWSER EXTENSION PAIRING =====================

/**
 * Generate a pairing code for browser extension
 * @returns {Promise<{secret: string}>}
 */
export async function generatePairingCode() {
  if (!isElectron) {
    console.warn('Not in Electron environment');
    return { secret: null };
  }
  
  if (!window.api?.generatePairingCode) {
    console.error('generatePairingCode API not available');
    return { secret: null };
  }
  
  try {
    return await window.api.generatePairingCode();
  } catch (error) {
    console.error('[API] generatePairingCode error:', error);
    return { secret: null };
  }
}

/**
 * Verify a pairing code for browser extension
 * @param {string} secret - The pairing code to verify
 * @returns {Promise<{valid: boolean}>}
 */
export async function verifyPairingCode(secret) {
  if (!isElectron) {
    console.warn('Not in Electron environment');
    return { valid: false };
  }
  
  if (!window.api?.verifyPairingCode) {
    console.error('verifyPairingCode API not available');
    return { valid: false };
  }
  
  try {
    return await window.api.verifyPairingCode(secret);
  } catch (error) {
    console.error('[API] verifyPairingCode error:', error);
    return { valid: false };
  }
}

// ===================== BIOMETRIC OPERATIONS =====================

/**
 * Check if biometric authentication is available
 * @returns {Promise<boolean>}
 */
export async function isBiometricAvailable() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('biometric')) return false;
    
    const result = await window.api.biometric.isAvailable();
    return result?.available === true;
  } catch (error) {
    console.error('[API] isBiometricAvailable error:', error);
    return false;
  }
}

/**
 * Check if biometric authentication is enabled
 * @returns {Promise<boolean>}
 */
export async function isBiometricEnabled() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('biometric')) return false;
    
    const result = await window.api.biometric.isEnabled();
    return result === true;
  } catch (error) {
    console.error('[API] isBiometricEnabled error:', error);
    return false;
  }
}

/**
 * Enable biometric authentication
 * @returns {Promise<boolean>}
 */
export async function enableBiometric() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('biometric')) return false;
    
    const result = await window.api.biometric.enable();
    return result === true;
  } catch (error) {
    console.error('[API] enableBiometric error:', error);
    return false;
  }
}

/**
 * Disable biometric authentication
 * @returns {Promise<boolean>}
 */
export async function disableBiometric() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('biometric')) return false;
    
    const result = await window.api.biometric.disable();
    return result === true;
  } catch (error) {
    console.error('[API] disableBiometric error:', error);
    return false;
  }
}

/**
 * Unlock vault using biometric authentication
 * @returns {Promise<Object>}
 */
export async function unlockWithBiometric() {
  try {
    if (!isElectron) return { success: false, error: 'Not in Electron' };
    if (!isApiMethodAvailable('biometric')) return { success: false, error: 'Biometric API not available' };
    
    const result = await window.api.biometric.unlock();
    return result;
  } catch (error) {
    console.error('[API] unlockWithBiometric error:', error);
    return { success: false, error: error.message };
  }
}

// ===================== SYNC OPERATIONS =====================

/**
 * Push vault to IPFS
 * @returns {Promise<Object>}
 */
export async function syncPush() {
  try {
    if (!isElectron) return { success: false, error: 'Not in Electron' };
    if (!isApiMethodAvailable('sync')) return { success: false, error: 'Sync API not available' };
    
    const result = await window.api.sync.push();
    return result;
  } catch (error) {
    console.error('[API] syncPush error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Pull vault from IPFS
 * @returns {Promise<Object>}
 */
export async function syncPull() {
  try {
    if (!isElectron) return { success: false, error: 'Not in Electron' };
    if (!isApiMethodAvailable('sync')) return { success: false, error: 'Sync API not available' };
    
    const result = await window.api.sync.pull();
    return result;
  } catch (error) {
    console.error('[API] syncPull error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current IPFS CID
 * @returns {Promise<string|null>}
 */
export async function getSyncCID() {
  try {
    if (!isElectron) return null;
    if (!isApiMethodAvailable('sync')) return null;
    
    const result = await window.api.sync.getCID();
    return result?.cid || null;
  } catch (error) {
    console.error('[API] getSyncCID error:', error);
    return null;
  }
}

// ===================== SETTINGS OPERATIONS =====================

/**
 * Get auto-sync setting
 * @returns {Promise<boolean>}
 */
export async function getAutoSync() {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('settings')) return false;
    
    const result = await window.api.settings.getAutoSync();
    return result === true;
  } catch (error) {
    console.error('[API] getAutoSync error:', error);
    return false;
  }
}

/**
 * Set auto-sync setting
 * @param {boolean} enabled - Whether auto-sync should be enabled
 * @returns {Promise<boolean>}
 */
export async function setAutoSync(enabled) {
  try {
    if (!isElectron) return false;
    if (!isApiMethodAvailable('settings')) return false;
    
    const result = await window.api.settings.setAutoSync(enabled);
    return result === true;
  } catch (error) {
    console.error('[API] setAutoSync error:', error);
    return false;
  }
}

// ===================== UTILITY FUNCTIONS =====================

/**
 * Check if API is available and ready
 * @returns {Promise<Object>}
 */
export async function checkApiStatus() {
  try {
    if (!isElectron) {
      return { available: false, reason: 'Not in Electron' };
    }
    
    const requiredMethods = [
      'getVaultEntries',
      'saveVaultEntry',
      'deleteVaultEntry',
      'isInitialized',
      'isUnlocked',
    ];
    
    const missingMethods = requiredMethods.filter(
      method => !isApiMethodAvailable(method)
    );
    
    return {
      available: missingMethods.length === 0,
      electron: true,
      missingMethods,
      methods: apiCache.available,
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

/**
 * Reset vault (for debugging purposes)
 * @returns {Promise<Object>}
 */
export async function resetVault() {
  try {
    if (!isElectron) return { success: false, error: 'Not in Electron' };
    if (!window.api?.resetVault) {
      return { success: false, error: 'resetVault not available' };
    }
    
    const result = await window.api.resetVault();
    return result;
  } catch (error) {
    console.error('[API] resetVault error:', error);
    return { success: false, error: error.message };
  }
}

// ===================== EXPORTS =====================

// Default export for convenience
export default {
  // Vault CRUD
  getVaultEntries,
  saveVaultEntry,
  deleteVaultEntry,
  addVaultEntry,
  updateVaultEntry,
  loadVault,
  
  // Vault State
  isInitialized,
  isUnlocked,
  unlockVault,
  initVault,
  lockVault,
  changePassword,
  
  // Browser Extension Pairing
  generatePairingCode,
  verifyPairingCode,
  
  // Biometric
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  unlockWithBiometric,
  
  // Sync
  syncPush,
  syncPull,
  getSyncCID,
  
  // Settings
  getAutoSync,
  setAutoSync,
  
  // Utilities
  checkApiStatus,
  resetVault,
};