import express from 'express';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../config/db.js';
import { requireAuth, requireCsrf, requireEncryptedBody, requireSecuritySession, validateBody, verifySignedBody } from '../middleware/security.js';
import { appendSecurityLog, hashRefreshToken, sanitizeText, timingSafeEqualString } from '../utils/security.js';

const router = express.Router();

const plans = [
  {
    code: 'basic',
    name: 'Basic',
    price: 199,
    currency: 'INR',
    description: 'One screen, HD playback, limited downloads.',
    features: ['HD streaming', '1 screen', 'Download support']
  },
  {
    code: 'standard',
    name: 'Standard',
    price: 499,
    currency: 'INR',
    description: 'Two screens, full catalog, and better bitrate.',
    features: ['Full catalog', '2 screens', 'Higher bitrate']
  },
  {
    code: 'premium',
    name: 'Premium',
    price: 799,
    currency: 'INR',
    description: 'Four screens, best quality, family-ready profile controls.',
    features: ['4 screens', '4K-ready', 'Profile controls']
  }
];

const planSchema = z.object({
  planCode: z.enum(['basic', 'standard', 'premium'])
});

const verifySchema = z.object({
  planCode: z.enum(['basic', 'standard', 'premium']),
  razorpayOrderId: z.string().min(8).max(120),
  razorpayPaymentId: z.string().min(8).max(120),
  razorpaySignature: z.string().min(8).max(255)
});

const razorpay = env.razorpayKeyId && env.razorpayKeySecret
  ? new Razorpay({ key_id: env.razorpayKeyId, key_secret: env.razorpayKeySecret })
  : null;

function getPlan(planCode) {
  return plans.find((plan) => plan.code === planCode) || null;
}

router.get('/plans', async (req, res) => {
  return res.json({ plans });
});

router.post('/create-order', requireSecuritySession, requireCsrf, requireEncryptedBody, verifySignedBody, requireAuth, validateBody(planSchema), async (req, res, next) => {
  try {
    const plan = getPlan(req.body.planCode);
    if (!plan) {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }

    const amountPaise = plan.price * 100;
    const notes = { planCode: plan.code, userId: String(req.auth.sub) };
    const order = razorpay
      ? await razorpay.orders.create({ amount: amountPaise, currency: plan.currency, receipt: `playflix_${req.auth.sub}_${Date.now()}`, notes })
      : {
          id: `order_${crypto.randomUUID().replace(/-/g, '')}`,
          amount: amountPaise,
          currency: plan.currency,
          receipt: `playflix_${req.auth.sub}_${Date.now()}`,
          notes
        };

    await query('INSERT INTO payments (user_id, plan_code, amount_paise, currency, razorpay_order_id, status) VALUES (?, ?, ?, ?, ?, ?)', [
      req.auth.sub,
      plan.code,
      amountPaise,
      plan.currency,
      order.id,
      'created'
    ]);

    return res.json({
      order,
      plan,
      razorpayKeyId: env.razorpayKeyId || 'rzp_test_placeholder',
      provider: razorpay ? 'razorpay' : 'mock'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify', requireSecuritySession, requireCsrf, requireEncryptedBody, verifySignedBody, requireAuth, validateBody(verifySchema), async (req, res, next) => {
  try {
    const plan = getPlan(req.body.planCode);
    if (!plan) {
      return res.status(400).json({ message: 'Invalid plan selected.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.razorpayKeySecret || 'mock-secret')
      .update(`${req.body.razorpayOrderId}|${req.body.razorpayPaymentId}`)
      .digest('hex');

    if (!timingSafeEqualString(expectedSignature, req.body.razorpaySignature)) {
      await query('UPDATE payments SET status = ? WHERE razorpay_order_id = ?', ['failed', req.body.razorpayOrderId]);
      await appendSecurityLog({ level: 'warn', event: 'razorpay_signature_failed', ip: req.ip, userId: req.auth.sub, orderId: req.body.razorpayOrderId });
      return res.status(400).json({ message: 'Payment signature verification failed.' });
    }

    await query('UPDATE users SET subscription_plan = ?, subscription_status = ?, subscription_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY) WHERE id = ?', [plan.code, 'active', req.auth.sub]);
    await query('UPDATE payments SET razorpay_payment_id = ?, razorpay_signature = ?, status = ? WHERE razorpay_order_id = ?', [
      sanitizeText(req.body.razorpayPaymentId),
      sanitizeText(req.body.razorpaySignature),
      'verified',
      req.body.razorpayOrderId
    ]);

    const userRows = await query('SELECT id, name, email, role, subscription_plan, subscription_status FROM users WHERE id = ? LIMIT 1', [req.auth.sub]);
    const user = userRows[0];

    return res.json({
      message: 'Subscription activated.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionPlan: user.subscription_plan,
        subscriptionStatus: user.subscription_status
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    await query('UPDATE users SET subscription_status = ?, subscription_expires_at = UTC_TIMESTAMP() WHERE id = ?', ['inactive', req.auth.sub]);
    return res.json({ message: 'Subscription cancelled.' });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const rows = await query('SELECT id, plan_code, amount_paise, currency, razorpay_order_id, razorpay_payment_id, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC', [req.auth.sub]);
    return res.json({ payments: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
