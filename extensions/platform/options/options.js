import { sendRuntimeMessage } from '../shared/browser/runtime.js';
import { ExtensionMessageType } from '../shared/bridge/protocol.js';

const desktopStatus = document.getElementById('desktopStatus');
const checkDesktop = document.getElementById('checkDesktop');
const diagnostics = document.getElementById('diagnostics');
const offlineStatus = document.getElementById('offlineStatus');
const clearOfflineCache = document.getElementById('clearOfflineCache');

function setDiagnostics(items) {
  diagnostics.textContent = '';
  for (const [label, value] of items) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = Array.isArray(value) ? value.join(', ') : String(value ?? 'n/a');
    diagnostics.append(dt, dd);
  }
}

async function updateStatus() {
  desktopStatus.textContent = 'Checking desktop bridge...';
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.getStatus });
  if (response?.ok && response.result?.connected) {
    desktopStatus.textContent = `Connected to AuraSafe desktop${response.result.version ? ` v${response.result.version}` : ''}.`;
    const diagnosticsResponse = await sendRuntimeMessage({ type: ExtensionMessageType.getDiagnostics });
    if (diagnosticsResponse?.ok) {
      const data = diagnosticsResponse.result;
      setDiagnostics([
        ['App', data.app],
        ['Version', data.version],
        ['Protocol', data.bridgeProtocol],
        ['Port', data.bridgePort],
        ['Capabilities', data.capabilities || []],
        ['Active Sessions', data.activeSessions],
      ]);
    }
  } else {
    desktopStatus.textContent = response?.result?.error || response?.error || 'AuraSafe desktop is not connected.';
    setDiagnostics([['Status', 'Desktop bridge unavailable']]);
  }
}

function renderOfflineState(state) {
  if (!state?.cacheAvailable) {
    offlineStatus.textContent = 'No offline vault metadata cache is stored yet.';
    return;
  }
  offlineStatus.textContent = `${state.cachedEntryCount} redacted vault entr${state.cachedEntryCount === 1 ? 'y' : 'ies'} cached${state.cachedAt ? ` on ${new Date(state.cachedAt).toLocaleString()}` : ''}. Pending sync operations: ${state.pendingSyncCount}.`;
}

async function updateOfflineState() {
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.getOfflineState });
  renderOfflineState(response?.ok ? response.result : null);
}

checkDesktop.addEventListener('click', updateStatus);
clearOfflineCache.addEventListener('click', async () => {
  clearOfflineCache.disabled = true;
  const response = await sendRuntimeMessage({ type: ExtensionMessageType.clearOfflineCache });
  renderOfflineState(response?.ok ? response.result : null);
  clearOfflineCache.disabled = false;
});
await updateStatus();
await updateOfflineState();
