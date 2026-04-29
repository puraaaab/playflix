import { z } from 'zod';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { appendSecurityLog, unpackData, getBearerToken, stampData, timingSafeEqualString, verifyAccessToken } from '../utils/security.js';
import { getSecuritySession } from '../services/securityStore.js';

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
  if (!req.securitySession) {
    appendSecurityLog({ level: 'warn', event: 'missing_security_session', ip: req.ip, path: req.path }).catch(() => null);
    return res.status(400).json({ message: 'Security session missing.' });
  }
  next();
}

export function requireCsrf(req, res, next) {
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
    return res.status(400).json({ message: 'Packed payload required.' });
  }

  if (!req.securitySession) {
    return res.status(400).json({ message: 'Security session missing.' });
  }

  if (!req.body || typeof req.body.payload !== 'string' || typeof req.body.iv !== 'string' || typeof req.body.encryptedKey !== 'string') {
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
  
  const expected = stampData(req.oneTimeKey, timestamp, encryptedBody.iv || '', encryptedBody.payload || '');
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

export function requestValidationErrorHandler(error, req, res, next) {
  if (error instanceof z.ZodError) {
    return res.status(422).json({
      message: 'Validation failed.',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }
  next(error);
}
