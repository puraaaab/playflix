import { query } from '../config/db.js';

// Exponential backoff multiplier (in seconds)
const BASE_LOCKOUT_DURATION = 60; // Start with 60 seconds
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_LEVEL = 5; // Max 1920 seconds (~32 minutes)
const FAILED_ATTEMPTS_THRESHOLD = 5;

export async function trackFailedAuthAttempt(userId, ipAddress, endpoint) {
  const now = new Date();
  
  try {
    // Find existing rate limit record
    const existing = await query(
      'SELECT id, attempt_count, backoff_level, locked_until FROM rate_limit_events WHERE user_id = ? AND ip_address = ? AND endpoint = ? ORDER BY updated_at DESC LIMIT 1',
      [userId || null, ipAddress, endpoint]
    );

    if (existing.length > 0) {
      const record = existing[0];
      const lockedUntil = record.locked_until ? new Date(record.locked_until) : null;

      // Check if currently locked
      if (lockedUntil && lockedUntil > now) {
        return {
          isLocked: true,
          lockedUntil,
          attemptCount: record.attempt_count + 1
        };
      }

      // Increment attempt count
      const newAttempts = record.attempt_count + 1;
      let backoffLevel = record.backoff_level;
      let newLockedUntil = null;

      if (newAttempts >= FAILED_ATTEMPTS_THRESHOLD) {
        backoffLevel = Math.min(backoffLevel + 1, MAX_BACKOFF_LEVEL);
        const lockoutDuration = BASE_LOCKOUT_DURATION * Math.pow(BACKOFF_MULTIPLIER, backoffLevel - 1);
        newLockedUntil = new Date(Date.now() + lockoutDuration * 1000);
      }

      await query(
        'UPDATE rate_limit_events SET attempt_count = ?, backoff_level = ?, locked_until = ?, updated_at = NOW() WHERE id = ?',
        [newAttempts, backoffLevel, newLockedUntil, record.id]
      );

      return {
        isLocked: newLockedUntil ? true : false,
        lockedUntil: newLockedUntil,
        attemptCount: newAttempts,
        backoffLevel
      };
    } else {
      // Create new record
      await query(
        'INSERT INTO rate_limit_events (user_id, ip_address, endpoint, attempt_count, backoff_level) VALUES (?, ?, ?, 1, 0)',
        [userId || null, ipAddress, endpoint]
      );

      return {
        isLocked: false,
        attemptCount: 1,
        backoffLevel: 0
      };
    }
  } catch (err) {
    console.error('Error tracking failed attempt:', err.message);
    return { isLocked: false, attemptCount: 0 };
  }
}

export async function checkRateLimitStatus(userId, ipAddress, endpoint) {
  const now = new Date();
  
  try {
    const result = await query(
      'SELECT attempt_count, backoff_level, locked_until FROM rate_limit_events WHERE user_id = ? AND ip_address = ? AND endpoint = ? ORDER BY updated_at DESC LIMIT 1',
      [userId || null, ipAddress, endpoint]
    );

    if (result.length === 0) {
      return { isLocked: false, canAttempt: true };
    }

    const record = result[0];
    const lockedUntil = record.locked_until ? new Date(record.locked_until) : null;

    if (lockedUntil && lockedUntil > now) {
      return {
        isLocked: true,
        canAttempt: false,
        lockedUntil,
        retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000)
      };
    }

    return {
      isLocked: false,
      canAttempt: true,
      attemptCount: record.attempt_count
    };
  } catch (err) {
    console.error('Error checking rate limit:', err.message);
    return { isLocked: false, canAttempt: true };
  }
}

export async function resetRateLimit(userId, ipAddress, endpoint) {
  try {
    await query(
      'DELETE FROM rate_limit_events WHERE user_id = ? AND ip_address = ? AND endpoint = ?',
      [userId || null, ipAddress, endpoint]
    );
  } catch (err) {
    console.error('Error resetting rate limit:', err.message);
  }
}

// Cleanup old records (run periodically)
export async function cleanupStaleRateLimitRecords() {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await query('DELETE FROM rate_limit_events WHERE updated_at < ?', [oneDayAgo]);
  } catch (err) {
    console.error('Error cleaning up rate limit records:', err.message);
  }
}
