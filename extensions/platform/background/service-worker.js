import { executeScript, getRuntime, insertCSS, tabsQuery, tabsSendMessage } from '../shared/browser/runtime.js';
import { BridgeAction, ExtensionMessageType } from '../shared/bridge/protocol.js';
import {
  callDesktop,
  discoverDesktopBridge,
  getDesktopDiagnostics,
  getDesktopStatus,
} from '../shared/bridge/desktopBridgeClient.js';
import { scoreEntriesForUrl } from '../shared/domain/domainMatch.js';
import { createLogger } from '../shared/logging/logger.js';
import { setSessionStatus } from '../shared/state/sessionStore.js';
import {
  cacheVaultMetadata,
  clearCachedVaultMetadata,
  getCachedVaultMetadata,
  getOfflineState,
} from '../shared/sync/offlineCache.js';

const runtime = getRuntime();
const logger = createLogger('background');

async function activeTab() {
  const tabs = await tabsQuery({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function listVaultEntries() {
  const entries = await callDesktop(BridgeAction.getVaultEntries);
  const normalized = Array.isArray(entries) ? entries : [];
  await cacheVaultMetadata(normalized);
  return normalized;
}

async function listVaultEntriesWithFallback() {
  try {
    return {
      entries: await listVaultEntries(),
      source: 'desktop',
    };
  } catch (error) {
    const cache = await getCachedVaultMetadata();
    return {
      entries: cache.entries || [],
      source: 'offline-cache',
      cachedAt: cache.cachedAt,
      error: error.message,
    };
  }
}

function moneyTotal(rows) {
  return rows.reduce((total, row) => total + Number(row.amount || row.balance || 0), 0);
}

async function dashboardSummary() {
  const status = await getDesktopStatus();
  if (!status.connected) {
    const [offline, site] = await Promise.all([
      getOfflineState(),
      entriesForActiveTab(),
    ]);
    return {
      status,
      offline,
      activeSite: site.host,
      siteEntries: site.entries.slice(0, 5),
      vault: {
        available: offline.cacheAvailable,
        count: offline.cachedEntryCount,
        siteMatches: site.entries.length,
        source: 'offline-cache',
      },
      finance: { available: false, accountCount: 0, transactionCount: 0, transactionTotal: 0 },
    };
  }

  const [site, vaultResult, accountsResult, transactionsResult] = await Promise.allSettled([
    entriesForActiveTab(),
    listVaultEntries(),
    callDesktop(BridgeAction.getAccounts),
    callDesktop(BridgeAction.getTransactions),
  ]);

  const vaultEntries = vaultResult.status === 'fulfilled' ? vaultResult.value : [];
  const accounts = accountsResult.status === 'fulfilled' && Array.isArray(accountsResult.value) ? accountsResult.value : [];
  const transactions = transactionsResult.status === 'fulfilled' && Array.isArray(transactionsResult.value)
    ? transactionsResult.value
    : [];

  return {
    status,
    offline: await getOfflineState(),
    activeSite: site.status === 'fulfilled' ? site.value.host : '',
    siteEntries: site.status === 'fulfilled' ? site.value.entries.slice(0, 5) : [],
    vault: {
      available: vaultResult.status === 'fulfilled',
      count: vaultEntries.length,
      siteMatches: site.status === 'fulfilled' ? site.value.entries.length : 0,
      source: vaultResult.status === 'fulfilled' ? 'desktop' : 'unavailable',
      error: vaultResult.status === 'rejected' ? vaultResult.reason?.message : null,
    },
    finance: {
      available: accountsResult.status === 'fulfilled' || transactionsResult.status === 'fulfilled',
      accountCount: accounts.length,
      transactionCount: transactions.length,
      transactionTotal: moneyTotal(transactions),
    },
  };
}

async function entriesForActiveTab() {
  const tab = await activeTab();
  const vault = await listVaultEntriesWithFallback();
  let host = '';
  try {
    host = tab?.url ? new URL(tab.url).hostname : '';
  } catch {
    host = '';
  }
  return {
    tab,
    host,
    source: vault.source,
    cachedAt: vault.cachedAt,
    offline: vault.source !== 'desktop',
    error: vault.error,
    entries: scoreEntriesForUrl(vault.entries, tab?.url || ''),
  };
}

async function ensureAutofillInjected(tabId) {
  await insertCSS({
    target: { tabId },
    files: ['content/autofill.css'],
  });
  await executeScript({
    target: { tabId },
    files: ['content/autofill.js'],
  });
}

async function handleMessage(message) {
  switch (message?.type) {
    case ExtensionMessageType.getStatus: {
      const status = await getDesktopStatus();
      await setSessionStatus(status);
      return status;
    }

    case ExtensionMessageType.connectDesktop: {
      const session = await discoverDesktopBridge();
      const status = {
        connected: true,
        mode: 'desktop',
        version: session.version,
        bridgeProtocol: session.bridgeProtocol,
        capabilities: session.capabilities,
        expiresAt: session.expiresAt,
      };
      await setSessionStatus(status);
      return status;
    }

    case ExtensionMessageType.searchVault: {
      const query = String(message.query || '').trim().toLowerCase();
      const vault = await listVaultEntriesWithFallback();
      return vault.entries
        .filter((entry) => {
          const haystack = [
            entry.name,
            entry.title,
            entry.username,
            entry.email,
            entry.login,
            entry.url,
            entry.website,
            entry.domain,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return !query || haystack.includes(query);
        })
        .slice(0, 25)
        .map((entry) => ({
          ...entry,
          offlineOnly: vault.source !== 'desktop' || Boolean(entry.offlineOnly),
          fillAvailable: vault.source === 'desktop' && entry.password != null,
        }));
    }

    case ExtensionMessageType.getEntriesForActiveTab:
      return await entriesForActiveTab();

    case ExtensionMessageType.getDiagnostics:
      return await getDesktopDiagnostics();

    case ExtensionMessageType.getDashboardSummary:
      return await dashboardSummary();

    case ExtensionMessageType.getOfflineState:
      return await getOfflineState();

    case ExtensionMessageType.clearOfflineCache:
      await clearCachedVaultMetadata();
      return await getOfflineState();

    case ExtensionMessageType.fillEntry: {
      if (message.entry?.offlineOnly || message.entry?.fillAvailable === false) {
        throw new Error('Offline cached entries are browse-only. Reconnect AuraSafe desktop to fill credentials.');
      }
      const tab = await activeTab();
      if (!tab?.id) {
        throw new Error('No active tab found');
      }
      await ensureAutofillInjected(tab.id);
      const response = await tabsSendMessage(tab.id, {
        type: 'aurasafe.content.fill',
        entry: message.entry,
      });
      return response || { success: true };
    }

    default:
      throw new Error(`Unsupported extension message: ${message?.type || 'unknown'}`);
  }
}

runtime.runtime.onInstalled.addListener(() => {
  logger.info('AuraSafe extension platform installed');
});

runtime.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      logger.warn('Message failed', { type: message?.type, error: error.message });
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});
