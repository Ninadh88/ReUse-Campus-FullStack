import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72)
});
const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) });
const safeUser = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });
const issueToken = user => jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, passwordHash } });
    res.status(201).json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    res.json({ user: safeUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
});

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(2).max(60)
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Name must be between 2 and 60 characters.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: { name: parsed.data.name }
    });

    res.json({ user: safeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({
      currentPassword: z.string().min(1).max(72),
      newPassword: z.string().min(8).max(72)
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'New password must contain at least 8 characters.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub }
    });

    if (!user || !(await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash
    ))) {
      return res.status(400).json({
        error: 'Current password is incorrect.'
      });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

    await prisma.user.update({
      where: { id: req.user.sub },
      data: { passwordHash }
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
});

export default router;
