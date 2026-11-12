import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export async function requireUser(req, res, next) {
  const token = req.cookies?.laxroa_session;
  if (!token) return res.status(401).json({ error: 'Please sign in.' });

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'laxroa',
      audience: 'laxroa-web',
    });
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  if (typeof payload.sub !== 'string') {
    return res.status(401).json({ error: 'Please sign in.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return res.status(401).json({ error: 'Please sign in.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  return next();
}
