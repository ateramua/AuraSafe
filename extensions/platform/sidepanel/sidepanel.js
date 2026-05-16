import { openOptionsPage, sendRuntimeMessage } from '../shared/browser/runtime.js';
import { ExtensionMessageType } from '../shared/bridge/protocol.js';

const statusText = document.getElementById('statusText');
const statusPill = document.getElementById('statusPill');
const activeSite = document.getElementById('activeSite');
const siteMatchCount = document.getElementById('siteMatchCount');
const vaultCount = document.getElementById('vaultCount');
const vaultState = document.getElementById('vaultState');
const transactionCount = document.getElementById('transactionCount');
const financeState = document.getElementById('financeState');
const entryList = document.getElementById('entryList');
const refreshButton = document.getElementById('refreshButton');
const connectButton = document.getElementById('connectButton');
const settingsButton = document.getElementById('settingsButton');

function setConnection(status) {
  const connected = Boolean(status?.connected);
  statusPill.textContent = connected ? 'Desktop' : 'Offline';
  statusPill.className = `pill ${connected ? 'connected' : 'disconnected'}`;
  statusText.textContent = connected
    ? `Connected to AuraSafe${status.version ? ` ${status.version}` : ''}.`
    : status?.error || 'Open AuraSafe desktop to enable live dashboard data.';
}

function entryLabel(entry) {
  return entry.displayName || entry.name || entry.title || entry.url || 'Untitled entry';
}

function entryMeta(entry) {
  return [entry.username || entry.email || entry.login, entry.displayHost || entry.url || entry.website || entry.domain]
    .filter(Boolean)
    .join(' · ');
}

function renderEntries(entries) {
  entryList.textContent = '';
  if (!entries?.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No suggested fills for this tab yet.';
    entryList.append(empty);
    return;
  }

  for (const entry of entries) {
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
      const response = await sendRuntimeMessage({ type: ExtensionMessageType.fillEntry, entry });
      fill.textContent = response?.ok ? 'Filled' : 'Retry';
      fill.disabled = false;
    });

    item.append(details, fill);
    entryList.append(item);
  }
}

function renderSummary(summary) {
  setConnection(summary.status);
  activeSite.textContent = summary.activeSite || 'Active tab';
  siteMatchCount.textContent = `${summary.vault.siteMatches || 0} matching vault entr${summary.vault.siteMatches === 1 ? 'y' : 'ies'} found.`;
  vaultCount.textContent = String(summary.vault.count || 0);
  vaultState.textContent = summary.vault.source === 'offline-cache'
    ? `Offline cache${summary.offline?.cachedAt ? ` from ${new Date(summary.offline.cachedAt).toLocaleString()}` : ' unavailable'}.`
    : summary.vault.available ? 'Vault is available through the desktop bridge.' : summary.vault.error || 'Vault unavailable.';
  transactionCount.textContent = String(summary.finance.transactionCount || 0);
  financeState.textContent = summary.finance.available
    ? `${summary.finance.accountCount || 0} accounts connected.`
    : 'Financial dashboard unavailable.';
  renderEntries(summary.siteEntries || []);
}

async function loadDashboard() {
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.getDashboardSummary });
  if (!response?.ok) {
    setConnection({ connected: false, error: response?.error || 'Unable to load dashboard.' });
    renderEntries([]);
    return;
  }
  renderSummary(response.result);
}

refreshButton.addEventListener('click', loadDashboard);
connectButton.addEventListener('click', async () => {
  await sendRuntimeMessage({ type: ExtensionMessageType.connectDesktop });
  await loadDashboard();
});
settingsButton.addEventListener('click', openOptionsPage);

await loadDashboard();
