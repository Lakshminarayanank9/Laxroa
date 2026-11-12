import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1); // behind Render/Vercel/nginx
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin tools (no Origin header) and the whitelisted sites
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
