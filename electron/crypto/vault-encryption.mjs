import crypto from 'crypto';
import fs from 'fs/promises';

/**
 * AES-256-GCM encryption for vault data
 */
export class VaultEncryption {
  static ALGORITHM = 'aes-256-gcm';
  static KEY_LENGTH = 32; // 256 bits
  static IV_LENGTH = 16; // 128 bits
  static TAG_LENGTH = 16; // 128 bits
  static SALT_LENGTH = 32; // 256 bits

  /**
   * Derive encryption key from password using PBKDF2
   */
  static deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Generate a random salt
   */
  static generateSalt() {
    return crypto.randomBytes(this.SALT_LENGTH);
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  static encrypt(data, password) {
    const salt = this.generateSalt();
    const key = this.deriveKey(password, salt);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipher(this.ALGORITHM, key);
    cipher.setAAD(Buffer.from('AuraSafe Vault Export'));

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: encrypted,
      version: '1.0'
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  static decrypt(encryptedData, password) {
    const { salt, iv, tag, data, version } = encryptedData;

    if (version !== '1.0') {
      throw new Error('Unsupported encryption version');
    }

    const key = this.deriveKey(password, Buffer.from(salt, 'hex'));
    const decipher = crypto.createDecipher(this.ALGORITHM, key);
    decipher.setAAD(Buffer.from('AuraSafe Vault Export'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Encrypt and save to file
   */
  static async encryptToFile(data, password, filePath) {
    const encrypted = this.encrypt(data, password);
    await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2));
  }

  /**
   * Load and decrypt from file
   */
  static async decryptFromFile(filePath, password) {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const encryptedData = JSON.parse(fileContent);
    return this.decrypt(encryptedData, password);
  }
}

/**
 * Validate encrypted file format
 */
export function validateEncryptedFile(data) {
  const required = ['salt', 'iv', 'tag', 'data', 'version'];
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (data.version !== '1.0') {
    throw new Error('Unsupported file version');
  }

  // Validate hex strings
  const hexFields = ['salt', 'iv', 'tag', 'data'];
  for (const field of hexFields) {
    if (!/^[0-9a-f]+$/i.test(data[field])) {
      throw new Error(`Invalid hex format for ${field}`);
    }
  }

  return true;
}