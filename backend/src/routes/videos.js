import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { query } from '../config/db.js';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { timingSafeEqualString, verifyAccessToken } from '../utils/security.js';
import { z } from 'zod';
import { requireAuth, requireCsrf, requirePackedBody, requireSecuritySession, validateBody, verifySignedBody } from '../middleware/security.js';
import { respondWithSecurityEnvelope } from '../utils/security.js';

const router = express.Router();

const actionSchema = z.object({
  videoId: z.coerce.number().int().positive(),
  action: z.enum(['watchlist', 'favorite', 'like', 'dislike']),
  active: z.boolean().optional().default(true)
});

const historySchema = z.object({
  videoId: z.coerce.number().int().positive(),
  positionSeconds: z.coerce.number().int().min(0).optional().default(0),
  completed: z.boolean().optional().default(false)
});

router.get('/catalog', async (req, res, next) => {
  try {
    const videos = await query('SELECT id, title, slug, description, genre, maturity_rating, thumbnail_url, is_premium FROM videos ORDER BY created_at DESC');
    return respondWithSecurityEnvelope(req, res, { videos });
  } catch (error) {
    next(error);
  }
});

router.get('/featured', async (req, res, next) => {
  try {
    const videos = await query('SELECT id, title, slug, description, genre, maturity_rating, thumbnail_url, is_premium FROM videos ORDER BY is_premium DESC, created_at DESC LIMIT 6');
    return respondWithSecurityEnvelope(req, res, { videos });
  } catch (error) {
    next(error);
  }
});

router.get('/my/watchlist', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT v.id, v.title, v.slug, v.description, v.genre, v.maturity_rating, v.thumbnail_url, v.is_premium
       FROM user_video_actions a
       INNER JOIN videos v ON v.id = a.video_id
       WHERE a.user_id = ? AND a.action_type = 'watchlist' AND a.is_active = 1
       ORDER BY a.updated_at DESC`,
      [req.auth.sub]
    );
    return respondWithSecurityEnvelope(req, res, { videos: rows });
  } catch (error) {
    return respondWithSecurityEnvelope(req, res, { message: error.message || 'Unable to load watchlist.' }, 500);
  }
});

router.get('/my/favorites', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT v.id, v.title, v.slug, v.description, v.genre, v.maturity_rating, v.thumbnail_url, v.is_premium
       FROM user_video_actions a
       INNER JOIN videos v ON v.id = a.video_id
       WHERE a.user_id = ? AND a.action_type = 'favorite' AND a.is_active = 1
       ORDER BY a.updated_at DESC`,
      [req.auth.sub]
    );
    return respondWithSecurityEnvelope(req, res, { videos: rows });
  } catch (error) {
    return respondWithSecurityEnvelope(req, res, { message: error.message || 'Unable to load favorites.' }, 500);
  }
});

router.get('/my/history', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT v.id, v.title, v.slug, v.description, v.genre, v.maturity_rating, v.thumbnail_url, v.is_premium,
              h.last_position_seconds, h.completed, h.last_watched_at
       FROM watch_history h
       INNER JOIN videos v ON v.id = h.video_id
       WHERE h.user_id = ?
       ORDER BY h.last_watched_at DESC`,
      [req.auth.sub]
    );
    return respondWithSecurityEnvelope(req, res, { videos: rows });
  } catch (error) {
    return respondWithSecurityEnvelope(req, res, { message: error.message || 'Unable to load history.' }, 500);
  }
});

router.get('/my/reactions', requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT video_id, action_type
       FROM user_video_actions
       WHERE user_id = ? AND action_type IN ('like', 'dislike') AND is_active = 1`,
      [req.auth.sub]
    );

    const reactions = {};
    for (const row of rows) {
      reactions[String(row.video_id)] = row.action_type;
    }
    return respondWithSecurityEnvelope(req, res, { reactions });
  } catch (error) {
    return respondWithSecurityEnvelope(req, res, { message: error.message || 'Unable to load reactions.' }, 500);
  }
});

router.post('/action', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, requireAuth, validateBody(actionSchema), async (req, res, next) => {
  try {
    const { videoId, action, active } = req.body;

    const videoRows = await query('SELECT id FROM videos WHERE id = ? LIMIT 1', [videoId]);
    if (!videoRows[0]) {
      return respondWithSecurityEnvelope(req, res, { message: 'Video not found.' }, 404);
    }

    await query(
      `INSERT INTO user_video_actions (user_id, video_id, action_type, is_active)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), updated_at = CURRENT_TIMESTAMP`,
      [req.auth.sub, videoId, action, active ? 1 : 0]
    );

    if ((action === 'like' || action === 'dislike') && active) {
      const opposite = action === 'like' ? 'dislike' : 'like';
      await query(
        `INSERT INTO user_video_actions (user_id, video_id, action_type, is_active)
         VALUES (?, ?, ?, 0)
         ON DUPLICATE KEY UPDATE is_active = 0, updated_at = CURRENT_TIMESTAMP`,
        [req.auth.sub, videoId, opposite]
      );
    }

    return respondWithSecurityEnvelope(req, res, { message: 'Action updated.' });
  } catch (error) {
    next(error);
  }
});

router.post('/history', requireSecuritySession, requireCsrf, requirePackedBody, verifySignedBody, requireAuth, validateBody(historySchema), async (req, res, next) => {
  try {
    const { videoId, positionSeconds, completed } = req.body;

    const videoRows = await query('SELECT id FROM videos WHERE id = ? LIMIT 1', [videoId]);
    if (!videoRows[0]) {
      return respondWithSecurityEnvelope(req, res, { message: 'Video not found.' }, 404);
    }

    await query(
      `INSERT INTO watch_history (user_id, video_id, last_position_seconds, completed, last_watched_at)
       VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         last_position_seconds = VALUES(last_position_seconds),
         completed = VALUES(completed),
         last_watched_at = UTC_TIMESTAMP()`,
      [req.auth.sub, videoId, positionSeconds, completed ? 1 : 0]
    );

    return respondWithSecurityEnvelope(req, res, { message: 'History updated.' });
  } catch (error) {
    next(error);
  }
});

router.post('/token/:videoId', async (req, res, next) => {
  try {
    // Issue a short-lived HMAC-signed stream token for the requesting user
    const accessToken = req.cookies?.playflix_access;
    if (!accessToken) {
      return respondWithSecurityEnvelope(req, res, { message: 'Authentication required to issue stream token.' }, 401);
    }

    let claims;
    try {
      claims = verifyAccessToken(accessToken);
    } catch (err) {
      return respondWithSecurityEnvelope(req, res, { message: 'Invalid session.' }, 401);
    }

    const videoId = String(req.params.videoId);
    const expires = Date.now() + 60 * 1000; // 60s token
    const payload = `${videoId}.${claims.sub}.${expires}`;
    const signature = crypto.createHmac('sha256', env.payloadSealPepper || 'dev-payload-pepper-change-me').update(payload).digest('hex');
    const token = `${expires}.${claims.sub}.${signature}`;
    return respondWithSecurityEnvelope(req, res, { token, expires });
  } catch (error) {
    next(error);
  }
});

router.get('/stream/:videoId', async (req, res, next) => {
  try {
    // Allow either cookie-based session or short-lived token in query
    let authUserId = null;
    const accessToken = req.cookies?.playflix_access;
    if (accessToken) {
      try {
        const claims = verifyAccessToken(accessToken);
        authUserId = String(claims.sub);
        req.auth = claims;
      } catch (err) {
        // fall through to token check
      }
    }

    if (!authUserId && req.query?.token) {
      const tokenParts = String(req.query.token).split('.');
      if (tokenParts.length !== 3) {
        return respondWithSecurityEnvelope(req, res, { message: 'Invalid stream token.' }, 403);
      }
      const [expiresStr, userId, signature] = tokenParts;
      const expires = Number.parseInt(expiresStr, 10);
      if (Number.isNaN(expires) || Date.now() > expires) {
        return respondWithSecurityEnvelope(req, res, { message: 'Stream token expired.' }, 403);
      }
      const payload = `${req.params.videoId}.${userId}.${expires}`;
      const expected = crypto.createHmac('sha256', env.payloadSealPepper || 'dev-payload-pepper-change-me').update(payload).digest('hex');
      if (!timingSafeEqualString(expected, signature)) {
        return respondWithSecurityEnvelope(req, res, { message: 'Invalid stream token signature.' }, 403);
      }
      authUserId = String(userId);
      req.auth = { sub: authUserId };
    }

    if (!req.auth) {
      return respondWithSecurityEnvelope(req, res, { message: 'Authentication required.' }, 401);
    }

    if (!req.auth.subscriptionStatus || !req.auth.role) {
      const userRows = await query('SELECT id, role, subscription_status FROM users WHERE id = ? LIMIT 1', [req.auth.sub]);
      const user = userRows[0];
      if (!user) {
        return respondWithSecurityEnvelope(req, res, { message: 'Authentication required.' }, 401);
      }
      req.auth.role = user.role;
      req.auth.subscriptionStatus = user.subscription_status;
    }

    if (req.auth.subscriptionStatus !== 'active' && req.auth.role !== 'admin') {
      return respondWithSecurityEnvelope(req, res, { message: 'An active subscription is required to stream premium content.' }, 402);
    }

    const rows = await query('SELECT * FROM videos WHERE id = ? LIMIT 1', [req.params.videoId]);
    const video = rows[0];
    if (!video) {
      return respondWithSecurityEnvelope(req, res, { message: 'Video not found.' }, 404);
    }

    if (!video.video_path) {
      return respondWithSecurityEnvelope(req, res, { message: 'Stream asset is not configured yet.' }, 404);
    }

    const filePath = path.resolve(video.video_path);
    if (!fs.existsSync(filePath)) {
      return respondWithSecurityEnvelope(req, res, { message: 'Stream file not found on disk.' }, 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');

    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) {
        return res.status(416).end();
      }

      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
      if (start >= fileSize || end >= fileSize || start > end) {
        return res.status(416).end();
      }

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    next(error);
  }
});

export default router;
