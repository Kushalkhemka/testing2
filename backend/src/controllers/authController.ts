import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import logger from '../config/logger';
import { UserRole } from '../types';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, full_name, role, phone } = req.body;

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Create user
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          password_hash,
          full_name,
          role: role || UserRole.STUDENT,
          phone,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('User registration error:', error);
        throw new Error('Failed to create user');
      }

      // Generate token
      const token = generateToken(user);

      // Remove password_hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: userWithoutPassword,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error || !user) {
        throw new ValidationError('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password_hash);

      if (!isPasswordValid) {
        throw new ValidationError('Invalid email or password');
      }

      // Update last login
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Generate token
      const token = generateToken(user);

      // Remove password_hash from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: userWithoutPassword,
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, profile_image_url, phone, is_active, created_at, last_login')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new NotFoundError('User not found');
      }

      res.json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { full_name, phone, profile_image_url } = req.body;

      const updateData: any = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (profile_image_url !== undefined) updateData.profile_image_url = profile_image_url;

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, email, full_name, role, profile_image_url, phone, is_active, created_at, last_login')
        .single();

      if (error) {
        logger.error('Profile update error:', error);
        throw new Error('Failed to update profile');
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { current_password, new_password } = req.body;

      // Get current user
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isPasswordValid = await comparePassword(current_password, user.password_hash);

      if (!isPasswordValid) {
        throw new ValidationError('Current password is incorrect');
      }

      // Hash new password
      const new_password_hash = await hashPassword(new_password);

      // Update password
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ password_hash: new_password_hash })
        .eq('id', userId);

      if (updateError) {
        logger.error('Password change error:', updateError);
        throw new Error('Failed to change password');
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users (Admin only)
   */
  static async getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, search, page = 1, limit = 10 } = req.query;

      let query = supabaseAdmin
        .from('users')
        .select('id, email, full_name, role, phone, is_active, created_at, last_login', { count: 'exact' });

      if (role) {
        query = query.eq('role', role);
      }

      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
      }

      const offset = (Number(page) - 1) * Number(limit);
      query = query.range(offset, offset + Number(limit) - 1);

      const { data: users, error, count } = await query;

      if (error) {
        logger.error('Get users error:', error);
        throw new Error('Failed to fetch users');
      }

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user status (Admin only)
   */
  static async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { is_active } = req.body;

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .update({ is_active })
        .eq('id', userId)
        .select('id, email, full_name, role, is_active')
        .single();

      if (error) {
        logger.error('Update user status error:', error);
        throw new Error('Failed to update user status');
      }

      res.json({
        success: true,
        message: 'User status updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user (Admin only)
   */
  static async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;

      // Prevent deleting yourself
      if (userId === req.user?.id) {
        throw new ValidationError('You cannot delete your own account');
      }

      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        logger.error('Delete user error:', error);
        throw new Error('Failed to delete user');
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
