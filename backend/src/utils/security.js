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

export function deriveKey(sessionKey) {
  const decoded = Buffer.from(String(sessionKey), 'base64');
  return crypto.createHash('sha256').update(decoded).digest();
}

export function encryptJsonPayload(payload, sessionKey) {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(sessionKey);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const input = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    payload: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64')
  };
}

export function decryptJsonPayload(envelope, sessionKey) {
  const payloadBuffer = Buffer.from(envelope.payload, 'base64');
  const ivBuffer = Buffer.from(envelope.iv, 'base64');
  const ciphertext = payloadBuffer.subarray(0, payloadBuffer.length - 16);
  const authTag = payloadBuffer.subarray(payloadBuffer.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(sessionKey), ivBuffer);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

export function signRequestPayload(sessionKey, timestamp, iv, payload) {
  return crypto
    .createHmac('sha256', deriveKey(sessionKey))
    .update(`${timestamp}.${iv}.${payload}`)
    .digest('base64');
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
  res.cookie('playflix_access', accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: 1000 * 60 * 15
  });
  res.cookie('playflix_refresh', refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 1000 * 60 * 60 * 24 * 7
  });
}

export function clearAuthCookies(res) {
  const secure = env.nodeEnv === 'production';
  res.clearCookie('playflix_access', { httpOnly: true, secure, sameSite: 'strict', path: '/' });
  res.clearCookie('playflix_refresh', { httpOnly: true, secure, sameSite: 'strict', path: '/api/auth' });
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
