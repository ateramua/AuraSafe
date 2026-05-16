export const DESKTOP_BRIDGE_PROTOCOL_VERSION = 1;

export const BRIDGE_PORT_START = 36000;
export const BRIDGE_PORT_END = 36020;
export const BRIDGE_SCAN_TIMEOUT_MS = 1200;
export const BRIDGE_COMMAND_TIMEOUT_MS = 5000;

export const BridgeAction = Object.freeze({
  ping: 'ping',
  getVaultEntries: 'getVaultEntries',
  saveVaultEntry: 'saveVaultEntry',
  queueAutofill: 'queueAutofill',
  getPendingAutofill: 'getPendingAutofill',
  consumePendingAutofill: 'consumePendingAutofill',
  getTransactions: 'getTransactions',
  getAccounts: 'getAccounts',
  getCategories: 'getCategories',
  getUserSettings: 'getUserSettings',
  saveUserSetting: 'saveUserSetting',
});

export const ExtensionMessageType = Object.freeze({
  getStatus: 'aurasafe.status.get',
  connectDesktop: 'aurasafe.desktop.connect',
  searchVault: 'aurasafe.vault.search',
  fillEntry: 'aurasafe.vault.fillEntry',
  getEntriesForActiveTab: 'aurasafe.vault.getEntriesForActiveTab',
  getDiagnostics: 'aurasafe.desktop.diagnostics',
  getDashboardSummary: 'aurasafe.dashboard.summary',
  getOfflineState: 'aurasafe.offline.state',
  clearOfflineCache: 'aurasafe.offline.clearCache',
});

export function buildBridgeCommand(action, payload = {}) {
  return {
    ...payload,
    action,
    protocolVersion: DESKTOP_BRIDGE_PROTOCOL_VERSION,
  };
}
