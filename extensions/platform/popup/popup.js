import { sendRuntimeMessage } from '../shared/browser/runtime.js';
import { ExtensionMessageType } from '../shared/bridge/protocol.js';

const statusPill = document.getElementById('statusPill');
const connectionTitle = document.getElementById('connectionTitle');
const connectionDetail = document.getElementById('connectionDetail');
const connectButton = document.getElementById('connectButton');
const refreshButton = document.getElementById('refreshButton');
const searchInput = document.getElementById('searchInput');
const entryList = document.getElementById('entryList');
const currentSite = document.getElementById('currentSite');
const offlineState = document.getElementById('offlineState');

let entries = [];
let siteEntries = [];
let searchTimer = null;

function setStatus(status) {
  const connected = Boolean(status?.connected);
  statusPill.textContent = connected ? 'Desktop' : 'Offline';
  statusPill.className = `pill ${connected ? 'connected' : 'disconnected'}`;
  connectionTitle.textContent = connected ? 'Connected to AuraSafe desktop' : 'Desktop app not connected';
  const capabilityCount = Array.isArray(status?.capabilities) ? status.capabilities.length : 0;
  connectionDetail.textContent = connected
    ? `Secure bridge active${status.version ? ` · v${status.version}` : ''}${status.bridgeProtocol ? ` · protocol ${status.bridgeProtocol}` : ''}${capabilityCount ? ` · ${capabilityCount} capabilities` : ''}.`
    : status?.error || 'Open AuraSafe desktop to enable vault search and autofill.';
}

function entryLabel(entry) {
  return entry.displayName || entry.name || entry.title || entry.url || 'Untitled entry';
}

function entryMeta(entry) {
  return [entry.username || entry.email || entry.login, entry.displayHost || entry.url || entry.website || entry.domain]
    .filter(Boolean)
    .join(' · ');
}

function formatCacheState(result) {
  if (!result?.offline) {
    return 'Live desktop data is available.';
  }
  if (!result.cachedAt) {
    return 'Offline mode: no local vault cache is available yet.';
  }
  return `Offline mode: showing encrypted local metadata cached ${new Date(result.cachedAt).toLocaleString()}.`;
}

function renderEntries() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const text = [
      entry.displayName,
      entry.name,
      entry.title,
      entry.username,
      entry.email,
      entry.login,
      entry.displayHost,
      entry.url,
      entry.website,
      entry.domain,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return !query || text.includes(query);
  });

  entryList.innerHTML = '';
  if (!filtered.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = query ? 'No matching vault entries.' : 'No entries found for this site yet.';
    entryList.append(empty);
    return;
  }

  for (const entry of filtered.slice(0, 12)) {
    const item = document.createElement('li');
    item.className = 'entry';
    const details = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'entry-name';
    name.textContent = entryLabel(entry);
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    meta.textContent = entryMeta(entry) || 'Ready to fill';
    details.append(name, meta);

    const fill = document.createElement('button');
    fill.className = 'primary';
    fill.type = 'button';
    const canFill = entry.fillAvailable !== false && !entry.offlineOnly;
    fill.textContent = canFill ? 'Fill' : 'Browse';
    fill.disabled = !canFill;
    fill.addEventListener('click', async () => {
      if (!canFill) {
        return;
      }
      fill.disabled = true;
      fill.textContent = 'Filling';
      const response = await sendRuntimeMessage({
        type: ExtensionMessageType.fillEntry,
        entry,
      });
      fill.textContent = response?.ok ? 'Filled' : 'Retry';
      fill.disabled = false;
    });

    item.append(details, fill);
    entryList.append(item);
  }
}

function renderEmpty(message) {
  entryList.innerHTML = '';
  const empty = document.createElement('li');
  empty.className = 'empty';
  empty.textContent = message;
  entryList.append(empty);
}

async function loadStatus() {
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.getStatus });
  setStatus(response?.result || { connected: false });
}

async function loadEntries() {
  renderEmpty('Loading current-site suggestions...');
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.getEntriesForActiveTab });
  if (!response?.ok) {
    entries = [];
    siteEntries = [];
    currentSite.textContent = 'Unable to read active tab';
    renderEmpty(response?.error || 'Unable to load vault entries.');
    return;
  }
  siteEntries = response.result?.entries || [];
  entries = siteEntries;
  currentSite.textContent = `${response.result?.host || 'Active tab'}${response.result?.offline ? ' · offline cache' : ''}`;
  offlineState.textContent = formatCacheState(response.result);
  renderEntries();
}

async function searchVault() {
  const query = searchInput.value.trim();
  if (!query) {
    entries = siteEntries;
    renderEntries();
    return;
  }

  const response = await sendRuntimeMessage({
    type: ExtensionMessageType.searchVault,
    query,
  });
  if (response?.ok) {
    entries = response.result || [];
    renderEntries();
  }
}

connectButton.addEventListener('click', async () => {
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.connectDesktop });
  setStatus(response?.result || { connected: false, error: response?.error });
  await loadEntries();
});

refreshButton.addEventListener('click', async () => {
  await loadStatus();
  await loadEntries();
});

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(searchVault, 120);
});

await loadStatus();
await loadEntries();
