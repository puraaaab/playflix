import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sanitizeHtml from 'sanitize-html';
import { env } from '../config/env.js';

const logDirectory = path.resolve('backend/logs');
const securityLogPath = path.join(logDirectory, 'security.log');
const accessTokenTtl = '15m';
const refreshTokenTtl = '7d';

import { getServerPrivateKey } from '../services/securityStore.js';

function decodeSessionKey(sessionKey) {
  return Buffer.from(String(sessionKey), 'base64');
}

function encodeBuffer(buffer) {
  return Buffer.from(buffer).toString('base64');
}

export function sealData(payload, sessionKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', decodeSessionKey(sessionKey), iv);
  const input = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = {
    iv: encodeBuffer(iv),
    payload: encodeBuffer(Buffer.concat([encrypted, tag]))
  };

  return {
    payload: encodeBuffer(Buffer.from(JSON.stringify(envelope), 'utf8'))
  };
}

export function unsealData(envelope, sessionKey) {
  let payloadValue = envelope.payload;
  let ivValue = envelope.iv;

  if (typeof payloadValue === 'string' && !ivValue) {
    try {
      const packedEnvelope = JSON.parse(Buffer.from(payloadValue, 'base64').toString('utf8'));
      if (packedEnvelope && typeof packedEnvelope === 'object') {
        payloadValue = packedEnvelope.payload;
        ivValue = packedEnvelope.iv;
      }
    } catch {
      // Fall through to legacy handling below.
    }
  }

  const payloadBuffer = Buffer.from(payloadValue, 'base64');
  const ivBuffer = Buffer.from(ivValue, 'base64');
  const ciphertext = payloadBuffer.subarray(0, payloadBuffer.length - 16);
  const authTag = payloadBuffer.subarray(payloadBuffer.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', decodeSessionKey(sessionKey), ivBuffer);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return JSON.parse(decrypted);
}

export function signSessionPayload(sessionKey, timestamp, iv, payload) {
  return crypto
    .createHmac('sha256', decodeSessionKey(sessionKey))
    .update(`${timestamp}.${iv}.${payload}`)
    .digest('base64');
}

export function respondWithSecurityEnvelope(req, res, payload, status = 200) {
  const sessionKey = req.securitySession?.sessionKey;
  if (sessionKey) {
    res.setHeader('x-playflix-sealed', 'true');
    return res.status(status).json(sealData(payload, sessionKey));
  }

  return res.status(status).json(payload);
}

export function stampData(key, timestamp, iv, payload) {
  return crypto
    .createHmac('sha256', key)
    .update(`${timestamp}.${iv}.${payload}`)
    .digest('base64');
}

export function packData(payload, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(['a', 'e', 's', '-', '2', '5', '6', '-', 'g', 'c', 'm'].join(''), key, iv);
  const input = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packedPayload = {
    iv: iv.toString('base64'),
    payload: Buffer.concat([encrypted, tag]).toString('base64')
  };

  return {
    payload: Buffer.from(JSON.stringify(packedPayload), 'utf8').toString('base64')
  };
}

export function unpackData(envelope) {
  const rsaPrivateKey = getServerPrivateKey();
  const encryptedKeyBuffer = Buffer.from(envelope[0], 'base64');

  const symmetricKey = crypto.privateDecrypt(
    {
      key: rsaPrivateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    encryptedKeyBuffer
  );

  let payloadValue = envelope[1];
  let ivValue = envelope.iv;

  if (typeof payloadValue === 'string' && !ivValue) {
    try {
      const packedEnvelope = JSON.parse(Buffer.from(payloadValue, 'base64').toString('utf8'));
      if (packedEnvelope && typeof packedEnvelope === 'object') {
        payloadValue = packedEnvelope.payload;
        ivValue = packedEnvelope.iv;
      }
    } catch {
      // Fall through to legacy handling below.
    }
  }

  const payloadBuffer = Buffer.from(payloadValue, 'base64');
  const ivBuffer = Buffer.from(ivValue, 'base64');
  const ciphertext = payloadBuffer.subarray(0, payloadBuffer.length - 16);
  const authTag = payloadBuffer.subarray(payloadBuffer.length - 16);

  const decipher = crypto.createDecipheriv(['a', 'e', 's', '-', '2', '5', '6', '-', 'g', 'c', 'm'].join(''), symmetricKey, ivBuffer);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return {
    oneTimeKey: symmetricKey,
    decrypted: JSON.parse(decrypted)
  };
}

export function timingSafeEqualString(expected, actual) {
  const expectedBuffer = Buffer.from(String(expected));
  const actualBuffer = Buffer.from(String(actual));

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      plan: user.subscription_plan,
      subscriptionStatus: user.subscription_status
    },
    env.jwtAccessSecret,
    { expiresIn: accessTokenTtl }
  );
}

export function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      tokenType: 'refresh'
    },
    env.jwtRefreshSecret,
    { expiresIn: refreshTokenTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const secure = env.nodeEnv === 'production';
  // Use 'lax' so cookies are sent on cross-origin requests when frontend and backend
  // share the same hostname but different ports (e.g. LAN / network-hosted dev).
  // 'strict' blocks cookies entirely in that scenario, causing 401s on /me and /refresh.
  res.cookie('playflix_access', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 15
  });
  res.cookie('playflix_refresh', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

export function clearAuthCookies(res) {
  const secure = env.nodeEnv === 'production';
  res.clearCookie('playflix_access', { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie('playflix_refresh', { httpOnly: true, secure, sameSite: 'lax', path: '/api/auth' });
}

export function sanitizeText(value) {
  return sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} }).trim();
}

export async function appendSecurityLog(event) {
  await fs.mkdir(logDirectory, { recursive: true });
  await fs.appendFile(securityLogPath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`, 'utf8');
}

export function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}

export function shouldRotateSessionKey(sessionTimestamp) {
  // Rotate every 60-120 minutes
  const sessionAgeMinutes = (Date.now() - sessionTimestamp) / (1000 * 60);
  return sessionAgeMinutes > 60;
}

export function createSessionKeyRotation(oldSessionKey) {
  // Generate new session key (32 bytes base64)
  const newKey = crypto.randomBytes(32).toString('base64');
  return {
    oldKey: oldSessionKey,
    newKey,
    rotatedAt: Date.now()
  };
}
