import fs from 'fs/promises';
import { parseCsvRecords } from './parse-csv.mjs';

const USERNAME_HEADERS = ['username', 'user', 'login', 'email'];
const PASSWORD_HEADERS = ['password', 'pass'];
const URL_HEADERS = ['url', 'website', 'uri'];
const NAME_HEADERS = ['name', 'title', 'label'];
const NOTES_HEADERS = ['extra', 'notes', 'note'];

/**
 * @param {string} header
 */
function normalizeHeader(header) {
  return (header || '').trim().toLowerCase();
}

/**
 * @param {string[]} headers
 * @param {string[]} aliases
 */
function findColumn(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.indexOf(alias);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

/**
 * @param {Record<string, string>} record
 * @param {{ username: string, password: string, url: string, name: string, notes: string }} columns
 */
export function mapRecordToCanonical(record, columns) {
  return {
    url: (record[columns.url] ?? '').trim(),
    username: (record[columns.username] ?? '').trim(),
    password: record[columns.password] ?? '',
    name: (record[columns.name] ?? '').trim(),
    notes: (record[columns.notes] ?? '').trim(),
  };
}

/**
 * @param {string} text
 */
export function parseCredentialCsv(text) {
  const { headers, records } = parseCsvRecords(text);

  const usernameCol = findColumn(headers, USERNAME_HEADERS);
  const passwordCol = findColumn(headers, PASSWORD_HEADERS);

  if (!usernameCol || !passwordCol) {
    throw new Error(
      'Invalid credentials CSV: the header row must include username and password columns ' +
        '(accepted names: username, user, login, email · password, pass). URL is optional.'
    );
  }

  const columns = {
    username: usernameCol,
    password: passwordCol,
    url: findColumn(headers, URL_HEADERS) || '',
    name: findColumn(headers, NAME_HEADERS) || '',
    notes: findColumn(headers, NOTES_HEADERS) || '',
  };

  return { headers, records, columns };
}

/**
 * @param {string} url
 */
export function titleFromUrl(url) {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname || url;
    return hostname.replace(/^www\./i, '') || url;
  } catch {
    return url;
  }
}

/**
 * Some password managers use a sentinel URL for secure notes (skipped).
 * @param {{ url?: string }} record
 */
export function isSecureNoteRow(record) {
  return (record.url || '').trim().toLowerCase() === 'http://sn';
}

/**
 * Import when username and password are present. URL is optional.
 * @param {{ url?: string, username?: string, password?: string }} record
 */
export function isImportableCredential(record) {
  if (isSecureNoteRow(record)) {
    return false;
  }

  const username = (record.username || '').trim();
  const password = record.password ?? '';

  return Boolean(username && password);
}

/**
 * @param {{ url?: string, username?: string, password?: string, name?: string, notes?: string }} record
 * @param {{ id?: string, now?: string }} [options]
 */
export function mapCredentialRecordToEntry(record, options = {}) {
  if (!isImportableCredential(record)) {
    return null;
  }

  const url = (record.url || '').trim();
  const username = record.username.trim();
  const password = record.password;
  const title =
    (record.name || '').trim() ||
    titleFromUrl(url) ||
    username ||
    'Imported credential';
  const now = options.now || new Date().toISOString();

  return {
    id: options.id || `csv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'credential',
    name: title,
    title,
    username,
    password,
    url,
    notes: (record.notes || '').trim(),
    created_at: now,
    updated_at: now,
  };
}

/**
 * @param {{ url?: string, username?: string }} entry
 */
export function duplicateKeyForEntry(entry) {
  const url = (entry.url || '').trim().toLowerCase();
  const username = (entry.username || '').trim().toLowerCase();
  return `${url}\0${username}`;
}

/**
 * @param {Record<string, string>[]} records
 * @param {{ username: string, password: string, url: string, name: string, notes: string }} columns
 */
export function summarizeCredentialRecords(records, columns) {
  let importable = 0;
  let secureNotes = 0;
  let incomplete = 0;

  for (const record of records) {
    const canonical = mapRecordToCanonical(record, columns);
    if (isSecureNoteRow(canonical)) {
      secureNotes += 1;
    } else if (isImportableCredential(canonical)) {
      importable += 1;
    } else {
      incomplete += 1;
    }
  }

  const sample = records
    .map((record) => mapCredentialRecordToEntry(mapRecordToCanonical(record, columns)))
    .filter(Boolean)
    .slice(0, 5)
    .map(({ title, username, url }) => ({ title, username, url: url || '(no URL)' }));

  return {
    totalRows: records.length,
    importable,
    secureNotes,
    incomplete,
    sample,
  };
}

/**
 * @param {Record<string, string>[]} records
 * @param {{ username: string, password: string, url: string, name: string, notes: string }} columns
 * @param {{ skipDuplicates?: boolean, existingEntries?: object[] }} [options]
 */
export function buildEntriesFromCredentialRecords(records, columns, options = {}) {
  const skipDuplicates = options.skipDuplicates !== false;
  const existingEntries = options.existingEntries || [];
  const seenKeys = new Set(existingEntries.map((entry) => duplicateKeyForEntry(entry)));

  const now = new Date().toISOString();
  const importedEntries = [];
  let skipped = 0;
  let skippedSecureNotes = 0;
  let skippedIncomplete = 0;
  let skippedDuplicates = 0;

  for (const record of records) {
    const canonical = mapRecordToCanonical(record, columns);

    if (isSecureNoteRow(canonical)) {
      skipped += 1;
      skippedSecureNotes += 1;
      continue;
    }

    if (!isImportableCredential(canonical)) {
      skipped += 1;
      skippedIncomplete += 1;
      continue;
    }

    const entry = mapCredentialRecordToEntry(canonical, { now });
    const key = duplicateKeyForEntry(entry);

    if (skipDuplicates && seenKeys.has(key)) {
      skipped += 1;
      skippedDuplicates += 1;
      continue;
    }

    importedEntries.push(entry);
    seenKeys.add(key);
  }

  return {
    importedEntries,
    skipped,
    skippedSecureNotes,
    skippedIncomplete,
    skippedDuplicates,
    totalRows: records.length,
  };
}

/**
 * @param {string} filePath
 */
export async function previewCredentialCsvFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const { headers, records, columns } = parseCredentialCsv(content);
  const summary = summarizeCredentialRecords(records, columns);

  return {
    headers,
    columns: {
      hasUrl: Boolean(columns.url),
      hasName: Boolean(columns.name),
      hasNotes: Boolean(columns.notes),
    },
    ...summary,
  };
}
