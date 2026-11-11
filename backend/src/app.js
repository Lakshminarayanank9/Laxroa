import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import healthRoutes from './routes/health.js';
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
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use('/api/health', healthRoutes);
// Step 2 adds: /api/auth   Step 3 adds: /api/products, /api/admin ...

app.use(notFound);
app.use(errorHandler);

export default app;
