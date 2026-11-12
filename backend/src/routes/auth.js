import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { adminEmail, adminUserId } from '../config/admin.js';
import { requireUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { createPasswordResetToken, hashPasswordResetToken } from '../lib/password-reset.js';

const router = Router();
const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(10).max(128);
const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});
const forgotPasswordSchema = z.object({ email: emailSchema });
const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
const sessionDurationMs = 12 * 60 * 60 * 1000;
const resetTokenDurationMs = 15 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  path: '/',
};

function issueSession(res, user) {
  const token = jwt.sign(
    { sessionVersion: user.sessionVersion },
    env.JWT_SECRET,
    {
      subject: user.id,
      issuer: 'laxroa',
      audience: 'laxroa-web',
      expiresIn: '12h',
    }
  );
  res.cookie('laxroa_session', token, {
    ...cookieOptions,
    maxAge: sessionDurationMs,
  });
}

function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sendPasswordResetEmail(email, resetUrl) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Reset your QIVRA password',
      text: `Use this link to reset your QIVRA password. It expires in 15 minutes: ${resetUrl}`,
      html: `<p>Use the link below to reset your QIVRA password. It expires in 15 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`,
    }),
  });
  if (!response.ok) {
    console.error(`Password reset email delivery failed with status ${response.status}.`);
    throw httpError(502, 'The password reset email could not be sent. Please try again later.');
  }
}

async function sendAdminUserIdEmail(email) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Your QIVRA admin sign-in ID',
      text: `Your QIVRA admin sign-in ID is ${adminUserId}. You can also sign in with your account email. If you did not request this reminder, you can ignore this email.`,
      html: `<p>Your QIVRA admin sign-in ID is <strong>${adminUserId}</strong>. You can also sign in with your account email.</p><p>If you did not request this reminder, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    console.error(`Admin user ID email delivery failed with status ${response.status}.`);
    throw httpError(502, 'The user ID reminder could not be sent. Please try again later.');
  }
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    issueSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      error.status = 409;
      error.message = 'An account with that email already exists.';
    }
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const loginId = email.toLowerCase();
    const user = loginId === adminUserId.toLowerCase()
      ? await prisma.user.findFirst({ where: { email: adminEmail, role: 'ADMIN' } })
      : await prisma.user.findUnique({ where: { email: loginId } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email, user ID, or password is incorrect.' });
    }

    issueSession(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireUser, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Choose a new password different from your current one.' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        sessionVersion: { increment: 1 },
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
    issueSession(res, updatedUser);
    return res.json({ user: publicUser(updatedUser) });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    if (!env.passwordResetReady) {
      return res.status(503).json({
        error: 'Password recovery email is not configured. Set EMAIL_API_KEY and EMAIL_FROM on the backend.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });
    if (!user) {
      return res.status(202).json({ message: 'If an account exists for that email, a reset link will be sent.' });
    }

    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpires: new Date(Date.now() + resetTokenDurationMs),
      },
    });
    const resetUrl = new URL('/', env.FRONTEND_URL);
    resetUrl.searchParams.set('resetToken', token);

    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (error) {
      await prisma.user.updateMany({
        where: { id: user.id, resetTokenHash: tokenHash },
        data: { resetTokenHash: null, resetTokenExpires: null },
      });
      throw error;
    }

    return res.status(202).json({ message: 'If an account exists for that email, a reset link will be sent.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-user-id', async (_req, res, next) => {
  try {
    if (!env.passwordResetReady) {
      return res.status(503).json({
        error: 'Admin ID reminder email is not configured on the backend.',
      });
    }

    const admin = await prisma.user.findFirst({
      where: { email: adminEmail, role: 'ADMIN' },
      select: { email: true },
    });
    if (admin) await sendAdminUserIdEmail(admin.email);

    return res.status(202).json({
      message: 'If the admin account is configured, its user ID reminder will be emailed to the registered admin address.',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const tokenHash = hashPasswordResetToken(token);
    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpires: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }

    const update = await prisma.user.updateMany({
      where: {
        id: user.id,
        resetTokenHash: tokenHash,
        resetTokenExpires: { gt: new Date() },
      },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        resetTokenHash: null,
        resetTokenExpires: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (update.count !== 1) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }

    return res.json({ message: 'Your password has been reset. Sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('laxroa_session', cookieOptions);
  res.json({ ok: true });
});

export default router;
