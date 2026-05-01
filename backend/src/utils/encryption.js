import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(env.databaseEncryptionKey || 'default-encryption-key-change-in-env', 'salt', 32);

export function encryptFieldValue(plaintext) {
  if (!plaintext) return null;
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return iv:encrypted for storage
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptFieldValue(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return null;
  
  try {
    const [ivHex, encryptedHex] = encrypted.split(':');
    if (!ivHex || !encryptedHex) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption error:', err.message);
    return null;
  }
}

export function encryptTOTPSecret(secret) {
  return encryptFieldValue(secret);
}

export function decryptTOTPSecret(encrypted) {
  return decryptFieldValue(encrypted);
}
