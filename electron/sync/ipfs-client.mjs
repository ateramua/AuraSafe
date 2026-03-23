import { create } from 'ipfs-http-client';

const ipfs = create({ url: 'http://localhost:5001' });

export async function uploadVault(data) {
  const { cid } = await ipfs.add(data);
  return cid.toString();
}

export async function downloadVault(cid) {
  const chunks = [];
  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}