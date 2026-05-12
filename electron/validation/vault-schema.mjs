/**
 * JSON Schema validation for vault export/import data
 */
export const VAULT_SCHEMA = {
  type: 'object',
  required: ['version', 'exportDate', 'entries'],
  properties: {
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+$'
    },
    exportDate: {
      type: 'string',
      format: 'date-time'
    },
    metadata: {
      type: 'object',
      properties: {
        created_at: { type: 'string', format: 'date-time' },
        last_backup_at: { type: 'string', format: 'date-time' },
        version: { type: 'string' }
      }
    },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string', minLength: 1 },
          color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          icon: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    },
    entries: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'username', 'password'],
        properties: {
          id: { type: 'number' },
          category: { type: 'number' },
          title: { type: 'string', minLength: 1 },
          username: { type: 'string' },
          password: { type: 'string', minLength: 1 },
          url: { type: 'string', format: 'uri' },
          notes: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};

/**
 * Simple schema validator (basic implementation)
 */
export class VaultSchemaValidator {
  static validate(data) {
    const errors = [];

    // Check required fields
    if (!data.version) errors.push('Missing required field: version');
    if (!data.exportDate) errors.push('Missing required field: exportDate');
    if (!data.entries) errors.push('Missing required field: entries');

    // Validate version format
    if (data.version && !/^\d+\.\d+$/.test(data.version)) {
      errors.push('Invalid version format');
    }

    // Validate exportDate
    if (data.exportDate && isNaN(Date.parse(data.exportDate))) {
      errors.push('Invalid exportDate format');
    }

    // Validate categories
    if (data.categories) {
      if (!Array.isArray(data.categories)) {
        errors.push('Categories must be an array');
      } else {
        data.categories.forEach((cat, index) => {
          if (!cat.name || typeof cat.name !== 'string') {
            errors.push(`Category ${index}: missing or invalid name`);
          }
          if (cat.color && !/^#[0-9a-fA-F]{6}$/.test(cat.color)) {
            errors.push(`Category ${index}: invalid color format`);
          }
        });
      }
    }

    // Validate entries
    if (data.entries) {
      if (!Array.isArray(data.entries)) {
        errors.push('Entries must be an array');
      } else {
        data.entries.forEach((entry, index) => {
          if (!entry.title || typeof entry.title !== 'string') {
            errors.push(`Entry ${index}: missing or invalid title`);
          }
          if (!entry.password || typeof entry.password !== 'string') {
            errors.push(`Entry ${index}: missing or invalid password`);
          }
          if (entry.url && !this.isValidUrl(entry.url)) {
            errors.push(`Entry ${index}: invalid URL format`);
          }
          if (entry.created_at && isNaN(Date.parse(entry.created_at))) {
            errors.push(`Entry ${index}: invalid created_at format`);
          }
          if (entry.updated_at && isNaN(Date.parse(entry.updated_at))) {
            errors.push(`Entry ${index}: invalid updated_at format`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }
}

/**
 * Sanitize imported data
 */
export function sanitizeVaultData(data) {
  const sanitized = { ...data };

  // Sanitize entries
  if (sanitized.entries) {
    sanitized.entries = sanitized.entries.map(entry => ({
      ...entry,
      title: this.escapeHtml(entry.title || ''),
      username: this.escapeHtml(entry.username || ''),
      password: entry.password || '', // Don't escape passwords
      url: entry.url || '',
      notes: this.escapeHtml(entry.notes || ''),
      created_at: entry.created_at || new Date().toISOString(),
      updated_at: entry.updated_at || new Date().toISOString()
    }));
  }

  // Sanitize categories
  if (sanitized.categories) {
    sanitized.categories = sanitized.categories.map(cat => ({
      ...cat,
      name: this.escapeHtml(cat.name || ''),
      color: cat.color || '#808080',
      icon: cat.icon || 'folder',
      created_at: cat.created_at || new Date().toISOString()
    }));
  }

  return sanitized;
}

/**
 * Simple HTML escape
 */
VaultSchemaValidator.escapeHtml = function(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};