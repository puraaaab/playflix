import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireCsrf, requirePackedBody, requireSecuritySession, validateBody, verifySignedBody } from '../middleware/security.js';
import { appendSecurityLog, clearAuthCookies, createAccessToken, createRefreshToken, hashPassword, hashRefreshToken, sanitizeText, setAuthCookies, verifyAccessToken, verifyPassword, verifyRefreshToken } from '../utils/security.js';

const router = express.Router();

const authSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(120)
});

function mapUser(user) {
  const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
  const now = new Date();
  const msLeft = expiresAt ? expiresAt.getTime() - now.getTime() : 0;
  const daysLeft = msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    subscriptionPlan: user.subscription_plan,
    subscriptionStatus: user.subscription_status,
    subscriptionExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    subscriptionDaysLeft: daysLeft
  };
}

async function issueSession(res, user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [hashRefreshToken(refreshToken), user.id]);
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

router.post('/signup', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, validateBody(authSchema), async (req, res, next) => {
  try {
    const name = sanitizeText(req.body.name || 'PlayFlix Member');
    const email = req.body.email;
    const passwordHash = await hashPassword(req.body.password);

    const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Account already exists.' });
    }

    const result = await query('INSERT INTO users (name, email, password_hash, role, subscription_plan, subscription_status) VALUES (?, ?, ?, ?, ?, ?)', [
      name,
      email,
      passwordHash,
      'user',
      'free',
      'inactive'
    ]);

    const user = {
      id: result.insertId,
      name,
      email,
      role: 'user',
      subscription_plan: 'free',
      subscription_status: 'inactive'
    };

    await issueSession(res, user);
    await query('INSERT INTO audit_logs (actor_user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)', [
      user.id,
      'signup',
      req.ip,
      JSON.stringify({ email })
    ]);

    return res.status(201).json({
      user: mapUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, validateBody(authSchema.omit({ name: true })), async (req, res, next) => {
  try {
    const email = req.body.email;
    const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) {
      await appendSecurityLog({ level: 'warn', event: 'failed_login_unknown_email', ip: req.ip, email });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const validPassword = await verifyPassword(req.body.password, user.password_hash);
    if (!validPassword) {
      await appendSecurityLog({ level: 'warn', event: 'failed_login_password', ip: req.ip, userId: user.id, email });
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    await issueSession(res, user);
    await query('INSERT INTO audit_logs (actor_user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)', [
      user.id,
      'login',
      req.ip,
      JSON.stringify({ email })
    ]);

    return res.json({
      user: mapUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.playflix_refresh;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token missing.' });
    }

    const claims = verifyRefreshToken(refreshToken);
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = rows[0];
    if (!user || !user.refresh_token_hash || user.refresh_token_hash !== hashRefreshToken(refreshToken)) {
      return res.status(401).json({ message: 'Refresh token invalid.' });
    }

    const accessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);
    await query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [hashRefreshToken(nextRefreshToken), user.id]);
    setAuthCookies(res, accessToken, nextRefreshToken);

    return res.json({
      user: mapUser(user)
    });
  } catch (error) {
    return res.status(401).json({ message: 'Session refresh failed.' });
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.playflix_refresh;
    if (refreshToken) {
      try {
        const claims = verifyRefreshToken(refreshToken);
        await query('UPDATE users SET refresh_token_hash = NULL WHERE id = ?', [claims.sub]);
      } catch {
        // Ignore invalid refresh tokens during logout.
      }
    }
    clearAuthCookies(res);
    return res.json({ message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res) => {
  const accessToken = req.cookies?.playflix_access;
  if (!accessToken) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const claims = verifyAccessToken(accessToken);
    const rows = await query('SELECT id, name, email, role, subscription_plan, subscription_status FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ user: mapUser(user) });
  } catch {
    return res.status(401).json({ message: 'Invalid session.' });
  }
});

router.get('/account', async (req, res) => {
  const accessToken = req.cookies?.playflix_access;
  if (!accessToken) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const claims = verifyAccessToken(accessToken);
    const users = await query('SELECT id, name, email, role, subscription_plan, subscription_status, subscription_expires_at, created_at FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const statsRows = await query(
      `SELECT
        (SELECT COUNT(*) FROM watch_history WHERE user_id = ?) AS watchedCount,
        (SELECT COUNT(*) FROM user_video_actions WHERE user_id = ? AND action_type = 'watchlist' AND is_active = 1) AS watchlistCount,
        (SELECT COUNT(*) FROM user_video_actions WHERE user_id = ? AND action_type = 'favorite' AND is_active = 1) AS favoriteCount,
        (SELECT COUNT(*) FROM user_video_actions WHERE user_id = ? AND action_type = 'like' AND is_active = 1) AS likeCount,
        (SELECT COUNT(*) FROM user_video_actions WHERE user_id = ? AND action_type = 'dislike' AND is_active = 1) AS dislikeCount`,
      [claims.sub, claims.sub, claims.sub, claims.sub, claims.sub]
    );

    const paymentRows = await query('SELECT plan_code, amount_paise, currency, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [claims.sub]);

    return res.json({
      user: mapUser(user),
      memberSince: user.created_at,
      stats: statsRows[0],
      recentPayments: paymentRows
    });
  } catch {
    return res.status(401).json({ message: 'Invalid session.' });
  }
});

export default router;
