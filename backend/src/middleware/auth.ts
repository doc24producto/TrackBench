import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      subscriptionTier: string;
    };
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireTier = (minTier: string) => {
  const tierOrder = ['FREE', 'STARTER', 'GROWTH', 'PRO'];
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userTierIndex = tierOrder.indexOf(req.user.subscriptionTier);
    const requiredIndex = tierOrder.indexOf(minTier);
    if (userTierIndex < requiredIndex) {
      res.status(403).json({ error: `This feature requires ${minTier} tier or above` });
      return;
    }
    next();
  };
};
