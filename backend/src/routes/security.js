import express from 'express';
import { env } from '../config/env.js';
import { createSecuritySession, rotateCsrfToken, getServerPublicKey, rotateSessionKey } from '../services/securityStore.js';

const router = express.Router();

router.get('/bootstrap', (req, res) => {
  const session = createSecuritySession();
  const secure = env.nodeEnv === 'production';
  res.cookie('playflix_session', session.sessionId, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  res.cookie('playflix_csrf', session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  return res.json({
    sessionId: session.sessionId,
    sessionKey: session.sessionKey,
    publicKey: getServerPublicKey(),
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
    sameSite: 'lax',
    path: '/api',
    maxAge: 1000 * 60 * 30
  });
  return res.json({ csrfToken: token });
});

// Session key rotation endpoint - client can check if key needs rotation
router.post('/check-key-rotation', (req, res) => {
  const sessionId = req.cookies?.playflix_session || req.header('x-playflix-session');
  const rotation = rotateSessionKey(sessionId);
  
  if (rotation) {
    const secure = env.nodeEnv === 'production';
    res.cookie('playflix_session', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api',
      maxAge: 1000 * 60 * 30
    });
    return res.json({
      rotated: true,
      newSessionKey: rotation.newKey,
      rotatedAt: rotation.rotatedAt
    });
  }
  
  return res.json({ rotated: false });
});

export default router;
