import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';
import { UserRole, User } from '../types';
import logger from '../config/logger';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

      // Fetch user from database
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (error || !user) {
        res.status(401).json({
          success: false,
          message: 'Invalid token or user not found.'
        });
        return;
      }

      req.user = user;
      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
      return;
    }

    if (!roles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource.'
      });
      return;
    }

    next();
  };
};

// Middleware to check if user is admin
export const isAdmin = authorize(UserRole.ADMIN);

// Middleware to check if user is teacher or admin
export const isTeacherOrAdmin = authorize(UserRole.TEACHER, UserRole.ADMIN);

// Middleware to check if user is student
export const isStudent = authorize(UserRole.STUDENT);
