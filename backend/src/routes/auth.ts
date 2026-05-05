import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

const generateTokens = (user: { id: string; email: string; subscriptionTier: string }) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, subscriptionTier: user.subscriptionTier },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/signup
router.post(
  '/signup',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().isLength({ min: 2 }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw createError(errors.array()[0].msg, 400);

    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw createError('Email already in use', 409);

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        subscription: { create: { tier: 'FREE', status: 'active' } },
        alertSettings: { create: {} },
      },
    });

    const tokens = generateTokens({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier });
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier }, ...tokens });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw createError('Invalid credentials', 400);

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) throw createError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw createError('Invalid credentials', 401);

    const tokens = generateTokens({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier });
    res.json({ user: { id: user.id, email: user.email, name: user.name, subscriptionTier: user.subscriptionTier }, ...tokens });
  })
);

// POST /api/auth/refresh-token
router.post(
  '/refresh-token',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError('Refresh token required', 400);

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) throw createError('User not found', 404);

    const tokens = generateTokens({ id: user.id, email: user.email, subscriptionTier: user.subscriptionTier });
    res.json(tokens);
  })
);

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, subscriptionTier: true, createdAt: true },
    });
    if (!user) throw createError('User not found', 404);
    res.json(user);
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return 200 to prevent email enumeration
    if (user) {
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiry: new Date(Date.now() + 3600000) },
      });
      // TODO: send email with reset link
    }
    res.json({ message: 'If that email exists, a reset link has been sent' });
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  authLimiter,
  [body('token').exists(), body('password').isLength({ min: 8 })],
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const user = await prisma.user.findFirst({
      where: {
        id: payload.id,
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) throw createError('Invalid or expired reset token', 400);

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });
    res.json({ message: 'Password reset successfully' });
  })
);

export default router;
