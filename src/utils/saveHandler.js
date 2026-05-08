// src/utils/saveHandler.js
// Unified saving mechanism - sequential function-based flow

/**
 * Unified save handler for all entry types
 * Follows sequential steps:
 * 1. Validate entry data
 * 2. Normalize entry format
 * 3. Save to vault
 * 4. Refresh data
 * 5. Handle cleanup
 */

export const saveEntry = async (api, entryData, isEditing = false) => {
  const steps = {
    status: 'idle',
    errors: [],
    result: null
  };

  try {
    // Step 1: Validation
    steps.status = 'validating';
    if (!api) {
      throw new Error('API not available');
    }
    
    if (!entryData.title || entryData.title.trim() === '') {
      throw new Error('Title is required');
    }

    // Step 2: Normalize entry
    steps.status = 'normalizing';
    const normalizedEntry = normalizeEntry(entryData);
    
    // Step 3: Save to vault
    steps.status = 'saving';
    const savedEntry = await api.saveVaultEntry(normalizedEntry);
    steps.result = savedEntry;
    
    // Step 4: Success cleanup
    steps.status = 'completed';
    return { success: true, entry: savedEntry, steps };
    
  } catch (error) {
    steps.status = 'failed';
    steps.errors.push(error.message);
    console.error('[SaveHandler] Save failed:', error);
    return { success: false, error: error.message, steps };
  }
};

/**
 * Normalize entry data based on its type
 */
const normalizeEntry = (entryData) => {
  const normalized = {
    id: entryData.id || null,
    title: entryData.title?.trim() || 'Untitled',
    notes: entryData.notes || '',
    type: entryData.type || 'credential',
    created_at: entryData.created_at || Date.now(),
    updated_at: Date.now()
  };

  // Add type-specific fields based on the entry type
  switch (normalized.type) {
    case 'credential':
      normalized.username = entryData.username || '';
      normalized.password = entryData.password || '';
      normalized.url = entryData.url || '';
      normalized.totpSecret = entryData.totpSecret || '';
      normalized.passkeyId = entryData.passkeyId || '';
      break;
      
    case 'contact':
      normalized.addressLine = entryData.addressLine || entryData.addressLine1 || '';
      normalized.city = entryData.city || '';
      normalized.state = entryData.state || '';
      normalized.zip = entryData.zip || '';
      normalized.country = entryData.country || '';
      break;
      
    case 'creditCard':
      normalized.cardNumber = entryData.cardNumber || '';
      normalized.cvv = entryData.cvv || '';
      normalized.expiry = entryData.expiry || '';
      break;
      
    case 'bankAccount':
      normalized.bankName = entryData.bankName || '';
      normalized.accountNumber = entryData.accountNumber || '';
      normalized.routingNumber = entryData.routingNumber || '';
      break;
      
    case 'driverLicense':
      normalized.licenseNumber = entryData.licenseNumber || '';
      normalized.dob = entryData.dob || '';
      break;
      
    case 'passkey':
      normalized.username = entryData.username || '';
      normalized.passkeyId = entryData.passkeyId || '';
      normalized.url = entryData.url || '';
      break;
      
    default:
      // Copy all fields for unknown types
      Object.assign(normalized, entryData);
  }

  return normalized;
};

/**
 * Bulk delete handler with sequential processing
 */
export const deleteEntries = async (api, ids, onProgress) => {
  const results = {
    success: [],
    failed: [],
    total: ids.length
  };

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      if (onProgress) onProgress(i + 1, ids.length, id);
      await api.deleteVaultEntry(id);
      results.success.push(id);
    } catch (error) {
      console.error(`[SaveHandler] Failed to delete ${id}:`, error);
      results.failed.push({ id, error: error.message });
    }
  }

  return results;
};