import express from 'express';
import { env } from '../config/env.js';
import { createSecuritySession, rotateCsrfToken } from '../services/securityStore.js';

const router = express.Router();

router.get('/bootstrap', (req, res) => {
  const session = createSecuritySession();
  const secure = env.nodeEnv === 'production';
  res.cookie('playflix_session', session.sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  res.cookie('playflix_csrf', session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  return res.json({
    sessionId: session.sessionId,
    sessionKey: session.sessionKey,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  });
});

router.get('/csrf', (req, res) => {
  const sessionId = req.cookies?.playflix_session || req.header('x-playflix-session');
  const token = rotateCsrfToken(sessionId);
  if (!token) {
    return res.status(400).json({ message: 'Security session missing.' });
  }
  const secure = env.nodeEnv === 'production';
  res.cookie('playflix_csrf', token, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  return res.json({ csrfToken: token });
});

export default router;
