import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { attachRequestContext, loadSecuritySession, requestValidationErrorHandler } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import securityRoutes from './routes/security.js';
import videoRoutes from './routes/videos.js';
import paymentRoutes from './routes/payments.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(attachRequestContext);
  const allowedOrigins = env.clientOrigin.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", ...allowedOrigins, 'https://checkout.razorpay.com'],
        frameSrc: ['https://checkout.razorpay.com']
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (env.nodeEnv !== 'production') return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-csrf-token',
      'x-playflix-enc',
      'x-playflix-timestamp',
      'x-playflix-signature',
      'x-playflix-session'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }));
  app.use(hpp());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(loadSecuritySession);
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Rate limit exceeded.' }
  }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', requestId: req.requestId });
  });

  app.use('/api/security', securityRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found.' });
  });

  app.use(requestValidationErrorHandler);
  app.use((error, req, res, next) => {
    console.error('[playflix]', error);
    res.status(500).json({ message: 'Internal server error.', requestId: req.requestId });
  });

  return app;
}
