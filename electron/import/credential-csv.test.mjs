import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEntriesFromCredentialRecords,
  isImportableCredential,
  isSecureNoteRow,
  mapCredentialRecordToEntry,
  parseCredentialCsv,
} from './credential-csv.mjs';

test('parseCredentialCsv requires username and password columns', () => {
  assert.throws(
    () => parseCredentialCsv('url,notes\nhttps://x.com,hello'),
    /username and password/
  );

  const { records, columns } = parseCredentialCsv(
    'username,password\nalice,secret\nbob,other'
  );
  assert.equal(records.length, 2);
  assert.ok(columns.username);
  assert.ok(columns.password);
});

test('parseCredentialCsv accepts optional url column', () => {
  const { records, columns } = parseCredentialCsv(
    'url,username,password,name\n,alice,secret,Alice Login\n'
  );
  assert.equal(records.length, 1);
  assert.ok(columns.url);
});

test('mapCredentialRecordToEntry works without url', () => {
  const entry = mapCredentialRecordToEntry({
    username: 'alice',
    password: 'secret',
    name: 'Work account',
  });
  assert.equal(entry.username, 'alice');
  assert.equal(entry.password, 'secret');
  assert.equal(entry.url, '');
  assert.equal(entry.title, 'Work account');
});

test('mapCredentialRecordToEntry uses hostname when url present', () => {
  const entry = mapCredentialRecordToEntry({
    url: 'https://github.com',
    username: 'dev',
    password: 'pw',
  });
  assert.equal(entry.url, 'https://github.com');
  assert.equal(entry.title, 'github.com');
});

test('skips secure note sentinel rows', () => {
  assert.equal(isSecureNoteRow({ url: 'http://sn' }), true);
  assert.equal(
    isImportableCredential({ url: 'https://x.com', username: 'a', password: 'p' }),
    true
  );
  assert.equal(
    isImportableCredential({ url: '', username: 'a', password: '' }),
    false
  );
});

test('buildEntriesFromCredentialRecords imports username/password only rows', () => {
  const { records, columns } = parseCredentialCsv(
    'username,password,url\nalice,secret,\nbob,pass2,https://b.com\n'
  );
  const result = buildEntriesFromCredentialRecords(records, columns, {
    skipDuplicates: false,
  });
  assert.equal(result.importedEntries.length, 2);
  assert.equal(result.importedEntries[0].url, '');
  assert.equal(result.importedEntries[1].url, 'https://b.com');
});

test('buildEntriesFromCredentialRecords skips duplicates when requested', () => {
  const { records, columns } = parseCredentialCsv('username,password\nalice,secret\n');
  const first = buildEntriesFromCredentialRecords(records, columns, {
    skipDuplicates: true,
  });
  assert.equal(first.importedEntries.length, 1);

  const second = buildEntriesFromCredentialRecords(records, columns, {
    skipDuplicates: true,
    existingEntries: first.importedEntries,
  });
  assert.equal(second.importedEntries.length, 0);
  assert.equal(second.skippedDuplicates, 1);
});
