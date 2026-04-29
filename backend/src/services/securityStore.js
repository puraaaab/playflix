import crypto from 'node:crypto';

const sessions = new Map();
const ttlMs = 1000 * 60 * 30;

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
    expiresAt: Date.now() + ttlMs
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
