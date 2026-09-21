const crypto = require('crypto');
const { config } = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

const getKey = () => {
  const key = Buffer.from(config.tokenEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY is missing or invalid (expected 32 bytes, base64-encoded)');
  }
  return key;
};

const isEncryptionConfigured = () => Buffer.from(config.tokenEncryptionKey, 'base64').length === 32;

// Output format: base64(iv).base64(authTag).base64(ciphertext)
const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
};

const decrypt = (payload) => {
  const [iv, authTag, ciphertext] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt, isEncryptionConfigured };
