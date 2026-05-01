import crypto from 'node:crypto';
import { query } from '../config/db.js';

const NONCE_TTL_SECONDS = 300; // 5 minutes

export function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

function hashNonce(nonce) {
  return crypto.createHash('sha256').update(nonce).digest('hex');
}

export async function createRequestNonce(userId = null, nonce = null) {
  const nonceValue = nonce || generateNonce();
  const nonceHash = hashNonce(nonceValue);
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);

  try {
    await query(
      'INSERT INTO request_nonces (user_id, nonce_hash, timestamp, expires_at) VALUES (?, ?, ?, ?)',
      [userId, nonceHash, timestamp, expiresAt]
    );
  } catch (err) {
    console.error('Error creating nonce:', err.message);
  }

  return nonceValue;
}

export async function verifyAndConsumeNonce(nonce, userId = null) {
  if (!nonce) return false;

  const nonceHash = hashNonce(nonce);
  const now = new Date();

  try {
    const result = await query(
      'SELECT id FROM request_nonces WHERE nonce_hash = ? AND used = 0 AND expires_at > ? LIMIT 1',
      [nonceHash, now]
    );

    if (result.length === 0) {
      return false; // Nonce not found or expired
    }

    // Mark as used
    await query('UPDATE request_nonces SET used = 1 WHERE nonce_hash = ?', [nonceHash]);
    return true;
  } catch (err) {
    console.error('Error verifying nonce:', err.message);
    return false;
  }
}

// Clean up expired nonces (run periodically)
export async function cleanupExpiredNonces() {
  try {
    const now = new Date();
    await query('DELETE FROM request_nonces WHERE expires_at < ? OR (used = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR))', [now]);
  } catch (err) {
    console.error('Error cleaning up nonces:', err.message);
  }
}
