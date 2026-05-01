import { z } from 'zod';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { appendSecurityLog, getBearerToken, stampData, timingSafeEqualString, unpackData, verifyAccessToken } from '../utils/security.js';
import { getSecuritySession } from '../services/securityStore.js';
import { checkRateLimitStatus, trackFailedAuthAttempt } from '../utils/rateLimiter.js';
import { verifyAndConsumeNonce } from '../utils/nonce.js';

export function attachRequestContext(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

function getSessionId(req) {
  return req.cookies?.playflix_session || req.header('x-playflix-session') || null;
}

export function loadSecuritySession(req, res, next) {
  const sessionId = getSessionId(req);
  const session = getSecuritySession(sessionId);
  if (session) {
    req.securitySession = session;
  }
  next();
}

export function requireSecuritySession(req, res, next) {
  const isEncrypted = req.header('x-playflix-mode') === 'secure';
  if (!isEncrypted) {
    return next();
  }

  if (!req.securitySession) {
    appendSecurityLog({ level: 'warn', event: 'missing_security_session', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(400).json({ message: 'Security session missing.' });
  }
  next();
}

export function requireCsrf(req, res, next) {
  const isEncrypted = req.header('x-playflix-mode') === 'secure';
  if (!isEncrypted) {
    return next();
  }

  const headerToken = req.header('x-csrf-token');
  if (!req.securitySession || !headerToken || !timingSafeEqualString(req.securitySession.csrfToken, headerToken)) {
    appendSecurityLog({ level: 'warn', event: 'csrf_check_failed', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(403).json({ message: 'CSRF validation failed.' });
  }
  next();
}

export function requirePackedBody(req, res, next) {
  const isEncrypted = req.header('x-playflix-mode') === 'secure';
  if (!isEncrypted) {
    req.encryptedBody = null;
    req.oneTimeKey = null;
    return next();
  }

  if (!req.securitySession) {
    return res.status(400).json({ message: 'Security session missing.' });
  }

  if (!Array.isArray(req.body) || req.body.length < 2) {
    return res.status(400).json({ message: 'Packed payload envelope is invalid.' });
  }

  try {
    req.encryptedBody = req.body;
    const { oneTimeKey, decrypted } = unpackData(req.body);
    req.body = decrypted;
    req.oneTimeKey = oneTimeKey;
    return next();
  } catch (error) {
    appendSecurityLog({ level: 'warn', event: 'payload_unpack_failed', ip: req.ip, path: req.path, error: error.message }).catch(() => null);
    return res.status(400).json({ message: 'Could not unpack request payload.' });
  }
}

export function verifySignedBody(req, res, next) {
  const isEncrypted = req.header('x-playflix-mode') === 'secure';
  if (!isEncrypted) {
    return next();
  }

  const timestamp = req.header('x-playflix-timestamp');
  const signature = req.header('x-playflix-signature');
  if (!timestamp || !signature || !req.securitySession) {
    return res.status(403).json({ message: 'Request signature missing.' });
  }

  const parsedTimestamp = Number.parseInt(timestamp, 10);
  if (Number.isNaN(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > 1000 * 60 * 5) {
    appendSecurityLog({ level: 'warn', event: 'stale_signature_timestamp', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(403).json({ message: 'Request signature timestamp expired.' });
  }

  const encryptedBody = req.encryptedBody || req.body || {};
  if (!req.oneTimeKey) {
    return res.status(400).json({ message: 'Missing one-time key for signature verification.' });
  }

  const expected = stampData(req.oneTimeKey, timestamp, Array.isArray(encryptedBody) ? encryptedBody[0] : '', Array.isArray(encryptedBody) ? encryptedBody[1] : '');
  if (!timingSafeEqualString(expected, signature)) {
    appendSecurityLog({ level: 'warn', event: 'request_signature_failed', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(403).json({ message: 'Request signature verification failed.' });
  }

  next();
}

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        message: 'Validation failed.',
        issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      });
    }
    req.body = result.data;
    next();
  };
}

export function requireAuth(req, res, next) {
  const token = getBearerToken(req) || req.cookies?.playflix_access;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    appendSecurityLog({ level: 'warn', event: 'invalid_access_token', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth || req.auth.role !== role) {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    next();
  };
}

export function requireNonce(req, res, next) {
  const nonce = req.body?.nonce || req.header('x-playflix-nonce');
  if (!nonce) {
    return res.status(400).json({ message: 'Nonce required for replay prevention.' });
  }

  req.pendingNonce = nonce;
  next();
}

export async function checkAuthRateLimit(req, res, next) {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const endpoint = req.path;
  
  const status = await checkRateLimitStatus(req.auth?.id || null, ipAddress, endpoint);
  
  if (status.isLocked) {
    appendSecurityLog({
      level: 'warn',
      event: 'rate_limit_locked',
      ip: ipAddress,
      path: endpoint,
      userId: req.auth?.id
    }).catch(() => null);
    
    return res.status(429).json({
      message: 'Too many attempts. Please try again later.',
      retryAfterSeconds: status.retryAfterSeconds
    });
  }
  
  next();
}

export async function recordFailedAuthAttempt(error, userId, ipAddress, endpoint) {
  const result = await trackFailedAuthAttempt(userId, ipAddress, endpoint);
  
  if (result.isLocked) {
    appendSecurityLog({
      level: 'error',
      event: 'auth_locked_exponential_backoff',
      ip: ipAddress,
      path: endpoint,
      userId,
      backoffLevel: result.backoffLevel,
      lockedUntil: result.lockedUntil
    }).catch(() => null);
  }
  
  return result;
}

export function requestValidationErrorHandler(error, req, res, next) {
  if (error instanceof z.ZodError) {
    return res.status(422).json({
      message: 'Validation failed.',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }
  next(error);
}
