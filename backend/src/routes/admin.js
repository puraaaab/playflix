import express from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { requireAuth, requireRole, validateBody } from '../middleware/security.js';

const router = express.Router();

const roleSchema = z.object({
  role: z.enum(['user', 'admin'])
});

router.get('/users', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await query('SELECT id, name, email, role, subscription_plan, subscription_status, created_at, updated_at FROM users ORDER BY created_at DESC');
    return res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.get('/payments', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const payments = await query(
      `SELECT p.id, p.user_id, u.email, u.name, p.plan_code, p.amount_paise, p.currency, p.razorpay_order_id, p.razorpay_payment_id, p.status, p.created_at
       FROM payments p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`,
      []
    );
    return res.json({ payments });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:userId/role', requireAuth, requireRole('admin'), validateBody(roleSchema), async (req, res, next) => {
  try {
    await query('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.userId]);
    return res.json({ message: 'Role updated.' });
  } catch (error) {
    next(error);
  }
});

export default router;
