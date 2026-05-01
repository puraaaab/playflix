import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireCsrf, requirePackedBody, requireSecuritySession, validateBody, verifySignedBody, requireAuth } from '../middleware/security.js';
import { appendSecurityLog, clearAuthCookies, createAccessToken, createRefreshToken, hashPassword, hashRefreshToken, respondWithSecurityEnvelope, sanitizeText, setAuthCookies, verifyAccessToken, verifyPassword, verifyRefreshToken } from '../utils/security.js';
import { generateTOTPSecret, verifyTOTPToken } from '../utils/totp.js';
import { encryptTOTPSecret, decryptTOTPSecret } from '../utils/encryption.js';
import { createRequestNonce, verifyAndConsumeNonce } from '../utils/nonce.js';
import { checkRateLimitStatus, trackFailedAuthAttempt } from '../utils/rateLimiter.js';

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
      return respondWithSecurityEnvelope(req, res, { message: 'Account already exists.' }, 409);
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

    return respondWithSecurityEnvelope(req, res, { user: mapUser(user) }, 201);
  } catch (error) {
    next(error);
  }
});

router.post('/login', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, validateBody(authSchema.omit({ name: true })), async (req, res, next) => {
  try {
    const email = req.body.email;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Check rate limit
    const rows = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const userPrecheck = rows[0];
    if (userPrecheck) {
      const rateCheckResult = await checkRateLimitStatus(userPrecheck.id, ipAddress, '/api/auth/login');
      if (rateCheckResult.isLocked) {
        return respondWithSecurityEnvelope(req, res, {
          message: 'Too many login attempts. Please try again later.',
          retryAfterSeconds: rateCheckResult.retryAfterSeconds
        }, 429);
      }
    }
    
    const result = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = result[0];
    
    if (!user) {
      if (userPrecheck) {
        await trackFailedAuthAttempt(userPrecheck.id, ipAddress, '/api/auth/login');
      }
      await appendSecurityLog({ level: 'warn', event: 'failed_login_unknown_email', ip: ipAddress, email });
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid credentials.' }, 401);
    }

    const validPassword = await verifyPassword(req.body.password, user.password_hash);
    if (!validPassword) {
      await trackFailedAuthAttempt(user.id, ipAddress, '/api/auth/login');
      await appendSecurityLog({ level: 'warn', event: 'failed_login_password', ip: ipAddress, userId: user.id, email });
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid credentials.' }, 401);
    }

    // Check if TOTP is enabled
    if (user.totp_enabled) {
      // Return response indicating TOTP is required
      return respondWithSecurityEnvelope(req, res, {
        message: 'TOTP verification required.',
        requiresTOTP: true,
        email: user.email
      }, 202); // 202 Accepted - waiting for additional verification
    }

    await issueSession(res, user);
    await query('INSERT INTO audit_logs (actor_user_id, event_type, ip_address, details) VALUES (?, ?, ?, ?)', [
      user.id,
      'login',
      ipAddress,
      JSON.stringify({ email })
    ]);

    return respondWithSecurityEnvelope(req, res, { user: mapUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.playflix_refresh;
    if (!refreshToken) {
      return respondWithSecurityEnvelope(req, res, { message: 'Refresh token missing.' }, 401);
    }

    const claims = verifyRefreshToken(refreshToken);
    const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = rows[0];
    if (!user || !user.refresh_token_hash || user.refresh_token_hash !== hashRefreshToken(refreshToken)) {
      return respondWithSecurityEnvelope(req, res, { message: 'Refresh token invalid.' }, 401);
    }

    const accessToken = createAccessToken(user);
    const nextRefreshToken = createRefreshToken(user);
    await query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [hashRefreshToken(nextRefreshToken), user.id]);
    setAuthCookies(res, accessToken, nextRefreshToken);

    return respondWithSecurityEnvelope(req, res, {
      user: mapUser(user)
    });
  } catch (error) {
    return respondWithSecurityEnvelope(req, res, { message: 'Session refresh failed.' }, 401);
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
    return respondWithSecurityEnvelope(req, res, { message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res) => {
  const accessToken = req.cookies?.playflix_access;
  if (!accessToken) {
    return respondWithSecurityEnvelope(req, res, { message: 'Authentication required.' }, 401);
  }

  try {
    const claims = verifyAccessToken(accessToken);
    const rows = await query('SELECT id, name, email, role, subscription_plan, subscription_status FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = rows[0];
    if (!user) {
      return respondWithSecurityEnvelope(req, res, { message: 'User not found.' }, 404);
    }

    return respondWithSecurityEnvelope(req, res, { user: mapUser(user) });
  } catch {
    return respondWithSecurityEnvelope(req, res, { message: 'Invalid session.' }, 401);
  }
});

router.get('/account', async (req, res) => {
  const accessToken = req.cookies?.playflix_access;
  if (!accessToken) {
    return respondWithSecurityEnvelope(req, res, { message: 'Authentication required.' }, 401);
  }

  try {
    const claims = verifyAccessToken(accessToken);
    const users = await query('SELECT id, name, email, role, subscription_plan, subscription_status, subscription_expires_at, created_at FROM users WHERE id = ? LIMIT 1', [claims.sub]);
    const user = users[0];
    if (!user) {
      return respondWithSecurityEnvelope(req, res, { message: 'User not found.' }, 404);
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

    return respondWithSecurityEnvelope(req, res, {
      user: mapUser(user),
      memberSince: user.created_at,
      stats: statsRows[0],
      recentPayments: paymentRows
    });
  } catch {
    return respondWithSecurityEnvelope(req, res, { message: 'Invalid session.' }, 401);
  }
});

// TOTP Setup: Initiate 2FA setup
router.post('/setup-2fa', requireAuth, async (req, res, next) => {
  try {
    const { secret, qrCode, manualEntryKey } = await generateTOTPSecret(req.auth.email);
    
    // Store secret in session for verification (not yet enabled)
    // Client will verify with TOTP token before finalizing
    return respondWithSecurityEnvelope(req, res, {
      qrCode,
      manualEntryKey,
      secret // Return plain secret for verification step
    }, 200);
  } catch (error) {
    appendSecurityLog({ level: 'error', event: 'totp_setup_failed', userId: req.auth.id, error: error.message }).catch(() => null);
    next(error);
  }
});

// TOTP Verification: Verify TOTP token and enable 2FA
router.post('/verify-2fa', requireAuth, validateBody(z.object({
  token: z.string().regex(/^\d{6}$/),
  secret: z.string()
})), async (req, res, next) => {
  try {
    const { token, secret } = req.body;
    
    // Verify the TOTP token
    if (!verifyTOTPToken(secret, token)) {
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid TOTP token.' }, 401);
    }
    
    // Encrypt and store the secret
    const encryptedSecret = encryptTOTPSecret(secret);
    await query('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?', [encryptedSecret, req.auth.id]);
    
    await appendSecurityLog({ level: 'info', event: '2fa_enabled', userId: req.auth.id }).catch(() => null);
    
    return respondWithSecurityEnvelope(req, res, { message: '2FA successfully enabled.' });
  } catch (error) {
    appendSecurityLog({ level: 'error', event: 'totp_verification_failed', userId: req.auth.id, error: error.message }).catch(() => null);
    next(error);
  }
});

// TOTP Validation: Validate TOTP during login (if enabled)
router.post('/verify-totp-login', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, validateBody(z.object({
  email: z.string().email(),
  token: z.string().regex(/^\d{6}$/)
})), async (req, res, next) => {
  try {
    const { email, token } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const rows = await query('SELECT id, totp_secret FROM users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    
    if (!user || !user.totp_secret) {
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid TOTP request.' }, 401);
    }
    
    const decryptedSecret = decryptTOTPSecret(user.totp_secret);
    if (!verifyTOTPToken(decryptedSecret, token)) {
      await trackFailedAuthAttempt(user.id, ipAddress, '/api/auth/verify-totp-login');
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid TOTP token.' }, 401);
    }
    
    // TOTP verified - issue session
    const fullUser = (await query('SELECT * FROM users WHERE id = ? LIMIT 1'))[0];
    await issueSession(res, fullUser);
    
    return respondWithSecurityEnvelope(req, res, { user: mapUser(fullUser), message: '2FA verified.' });
  } catch (error) {
    appendSecurityLog({ level: 'error', event: 'totp_login_verification_failed', error: error.message }).catch(() => null);
    next(error);
  }
});

// Disable 2FA
router.post('/disable-2fa', requireAuth, validateBody(z.object({
  password: z.string()
})), async (req, res, next) => {
  try {
    const rows = await query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.auth.id]);
    const user = rows[0];
    
    const validPassword = await verifyPassword(req.body.password, user.password_hash);
    if (!validPassword) {
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid password.' }, 401);
    }
    
    await query('UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?', [req.auth.id]);
    
    await appendSecurityLog({ level: 'info', event: '2fa_disabled', userId: req.auth.id }).catch(() => null);
    
    return respondWithSecurityEnvelope(req, res, { message: '2FA successfully disabled.' });
  } catch (error) {
    appendSecurityLog({ level: 'error', event: 'totp_disable_failed', userId: req.auth.id, error: error.message }).catch(() => null);
    next(error);
  }
});

export default router;
