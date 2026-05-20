/**
 * Crypto RNG for @noble/hashes (vault salt / key generation on React Native).
 * Import this before any @aurasafe/core code.
 */
import 'react-native-get-random-values';
import * as ExpoCrypto from 'expo-crypto';

type CryptoShim = { getRandomValues<T extends ArrayBufferView>(array: T): T };

function ensureGetRandomValues(): void {
  const root = globalThis as typeof globalThis & { crypto?: CryptoShim };
  const nodeGlobal = global as typeof global & { crypto?: CryptoShim };

  if (typeof root.crypto?.getRandomValues === 'function') {
    return;
  }
  if (typeof nodeGlobal.crypto?.getRandomValues === 'function') {
    root.crypto = nodeGlobal.crypto;
    return;
  }

  const shim: CryptoShim = {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      view.set(bytes);
      return array;
    },
  };

  (root as { crypto?: CryptoShim }).crypto = shim;
  (nodeGlobal as { crypto?: CryptoShim }).crypto = shim;
}

ensureGetRandomValues();
