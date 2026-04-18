// src/utils/totp.js

// TOTP generation utility
export async function generateTOTP(secret) {
  if (!secret) return null;
  
  try {
    // Base32 decode the secret
    const key = base32Decode(secret.toUpperCase());
    
    // Get current time window (30 seconds)
    const time = Math.floor(Date.now() / 1000 / 30);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(4, Math.floor(time / 2 ** 32));
    timeView.setUint32(8, time);
    
    // Create HMAC-SHA1
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const hash = new Uint8Array(signature);
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
    
    // Get 6-digit code
    const totp = (code % 1000000).toString().padStart(6, '0');
    return totp;
  } catch (err) {
    console.error('TOTP generation failed:', err);
    return null;
  }
}

// Get remaining seconds in current window
export function getRemainingSeconds() {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

// Base32 decoding (simplified - works for standard base32)
function base32Decode(str) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = [];
  
  for (let i = 0; i < str.length; i += 8) {
    const chunk = str.slice(i, i + 8).padEnd(8, '=');
    let bits = 0;
    let buffer = 0;
    
    for (let j = 0; j < 8; j++) {
      if (chunk[j] === '=') break;
      buffer = (buffer << 5) | base32chars.indexOf(chunk[j]);
      bits += 5;
      
      if (bits >= 8) {
        bits -= 8;
        bytes.push((buffer >> bits) & 0xff);
      }
    }
  }
  
  return new Uint8Array(bytes);
}