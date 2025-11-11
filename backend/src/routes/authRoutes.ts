import express from 'express';
import { body } from 'express-validator';
import { AuthController } from '../controllers/authController';
import { authenticate, isAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// Public routes
router.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('role').optional().isIn(['admin', 'teacher', 'student']).withMessage('Invalid role')
  ]),
  AuthController.register
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ]),
  AuthController.login
);

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile);

router.put(
  '/profile',
  authenticate,
  validate([
    body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('phone').optional().matches(/^[0-9+\-\s()]*$/).withMessage('Invalid phone number')
  ]),
  AuthController.updateProfile
);

router.post(
  '/change-password',
  authenticate,
  validate([
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ]),
  AuthController.changePassword
);

// Admin routes
router.get('/users', authenticate, isAdmin, AuthController.getAllUsers);

router.put(
  '/users/:userId/status',
  authenticate,
  isAdmin,
  validate([
    body('is_active').isBoolean().withMessage('is_active must be a boolean')
  ]),
  AuthController.updateUserStatus
);

router.delete('/users/:userId', authenticate, isAdmin, AuthController.deleteUser);

export default router;
