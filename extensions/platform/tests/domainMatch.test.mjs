import assert from 'node:assert/strict';
import test from 'node:test';

import {
  entryMatchesUrl,
  getRegistrableHost,
  normalizeEntryForDisplay,
  normalizeHost,
  scoreEntriesForUrl,
} from '../shared/domain/domainMatch.js';

test('normalizes hosts for matching', () => {
  assert.equal(normalizeHost('https://www.Example.com/login'), 'example.com');
  assert.equal(normalizeHost('WWW.EXAMPLE.COM.'), 'example.com');
  assert.equal(getRegistrableHost('accounts.example.com'), 'example.com');
});

test('matches entries against subdomains and registrable hosts', () => {
  assert.equal(
    entryMatchesUrl({ url: 'https://example.com' }, 'https://accounts.example.com/sign-in'),
    true
  );
  assert.equal(
    entryMatchesUrl({ domain: 'accounts.example.com' }, 'https://billing.example.com'),
    true
  );
  assert.equal(
    entryMatchesUrl({ domain: 'example.org' }, 'https://example.com'),
    false
  );
});

test('scores exact host matches ahead of registrable-domain matches', () => {
  const entries = [
    { id: 'root', name: 'Example', url: 'https://example.com' },
    { id: 'exact', name: 'Accounts', url: 'https://accounts.example.com' },
    { id: 'other', name: 'Other', url: 'https://other.test' },
  ];

  const [first, second] = scoreEntriesForUrl(entries, 'https://accounts.example.com/login');
  assert.equal(first.id, 'exact');
  assert.equal(second.id, 'root');
});

test('adds display fields without dropping original entry data', () => {
  const entry = normalizeEntryForDisplay({
    id: 'entry-1',
    title: 'Bank',
    website: 'https://bank.example',
    username: 'user@example.test',
  });

  assert.equal(entry.displayName, 'Bank');
  assert.equal(entry.displayHost, 'bank.example');
  assert.equal(entry.username, 'user@example.test');
});
