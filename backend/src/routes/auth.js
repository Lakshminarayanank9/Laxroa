import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});
const sessionDurationMs = 12 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  path: '/',
};

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: user.id,
      issuer: 'laxroa',
      audience: 'laxroa-web',
      expiresIn: '12h',
    });
    res.cookie('laxroa_session', token, {
      ...cookieOptions,
      maxAge: sessionDurationMs,
    });
    return res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('laxroa_session', cookieOptions);
  res.json({ ok: true });
});

export default router;
