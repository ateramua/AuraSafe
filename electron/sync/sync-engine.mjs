import Store from 'electron-store';
import { uploadVault, downloadVault } from './ipfs-client.mjs';
import { loadVaultEntries, saveVaultEntries, getVaultMetadata, importVaultData } from '../crypto/key-manager.mjs';

const settings = new Store({ name: 'settings' });

export function getCurrentCID() {
  return settings.get('syncCID', null);
}

function setCurrentCID(cid) {
  settings.set('syncCID', cid);
}

export async function pushToIPFS() {
  const entries = loadVaultEntries();
  const meta = getVaultMetadata();
  const data = {
    entries,
    _meta: meta,
  };
  const buffer = Buffer.from(JSON.stringify(data), 'utf8');
  const cid = await uploadVault(buffer);
  setCurrentCID(cid);
  return cid;
}

export async function pullFromIPFS() {
  const cid = getCurrentCID();
  if (!cid) return false;
  const buffer = await downloadVault(cid);
  const remote = JSON.parse(buffer.toString('utf8'));
  const remoteMeta = remote._meta || { lastModified: 0 };
  const localMeta = getVaultMetadata();
  if (remoteMeta.lastModified > localMeta.lastModified) {
    await importVaultData(remote);
    return true;
  }
  return false;
}