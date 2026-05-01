import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const KEY_DIR = path.resolve('backend/certs');
const KEY_FILE = path.join(KEY_DIR, 'server-encryption-keys.json');

function initializeKeys() {
  if (fs.existsSync(KEY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      return { publicKey: data.publicKey, privateKey: data.privateKey };
    } catch (error) {
      console.error('[PlayFlix] Failed to load encryption keys, generating new ones:', error);
    }
  }

  // Generate new 4096-bit key pair
  console.log('[PlayFlix] Generating 4096-bit RSA server keys...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }
  fs.writeFileSync(KEY_FILE, JSON.stringify({ publicKey, privateKey }), 'utf8');
  
  return { publicKey, privateKey };
}

const { publicKey, privateKey } = initializeKeys();

export function getServerPublicKey() {
  return publicKey;
}

export function getServerPrivateKey() {
  return crypto.createPrivateKey({ key: privateKey, format: 'pem', type: 'pkcs8' });
}

const sessions = new Map();
const ttlMs = 1000 * 60 * 30;
const sessionKeyRotationIntervalMs = 1000 * 60 * 60; // 60 minutes

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredSessions, 1000 * 60).unref();

export function createSecuritySession() {
  cleanupExpiredSessions();
  const sessionId = crypto.randomUUID();
  const sessionKey = crypto.randomBytes(32).toString('base64');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const session = {
    sessionId,
    sessionKey,
    csrfToken,
    expiresAt: Date.now() + ttlMs,
    createdAt: Date.now(),
    lastRotatedAt: Date.now()
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSecuritySession(sessionId) {
  cleanupExpiredSessions();
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function rotateSessionKey(sessionId) {
  const session = getSecuritySession(sessionId);
  if (!session) {
    return null;
  }

  const timeSinceLastRotation = Date.now() - session.lastRotatedAt;
  if (timeSinceLastRotation < sessionKeyRotationIntervalMs) {
    // Not yet time to rotate
    return null;
  }

  // Generate new session key
  const oldKey = session.sessionKey;
  session.sessionKey = crypto.randomBytes(32).toString('base64');
  session.lastRotatedAt = Date.now();
  session.expiresAt = Date.now() + ttlMs;
  sessions.set(sessionId, session);

  return {
    oldKey,
    newKey: session.sessionKey,
    rotatedAt: session.lastRotatedAt
  };
}

export function rotateCsrfToken(sessionId) {
  const session = getSecuritySession(sessionId);
  if (!session) {
    return null;
  }

  session.csrfToken = crypto.randomBytes(32).toString('hex');
  session.expiresAt = Date.now() + ttlMs;
  sessions.set(sessionId, session);
  return session.csrfToken;
}
