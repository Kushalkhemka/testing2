import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { QuestionType } from '../types';

export class QuestionController {
  /**
   * Create a new question
   */
  static async createQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const {
        question_type,
        question_text,
        question_image_url,
        difficulty_level,
        subject,
        topic,
        marks,
        negative_marks,
        options,
        correct_answers,
        explanation,
        tags
      } = req.body;

      // Validate question type
      if (!Object.values(QuestionType).includes(question_type)) {
        throw new ValidationError('Invalid question type');
      }

      // Validate based on question type
      if (
        (question_type === QuestionType.MCQ_SINGLE ||
         question_type === QuestionType.MCQ_MULTIPLE) &&
        (!options || options.length < 2)
      ) {
        throw new ValidationError('MCQ questions must have at least 2 options');
      }

      if (!correct_answers || correct_answers.length === 0) {
        throw new ValidationError('At least one correct answer is required');
      }

      const { data: question, error } = await supabaseAdmin
        .from('questions')
        .insert({
          created_by: userId,
          question_type,
          question_text,
          question_image_url,
          difficulty_level,
          subject,
          topic,
          marks: marks || 1.0,
          negative_marks: negative_marks || 0.0,
          options: options || null,
          correct_answers,
          explanation,
          tags: tags || [],
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('Create question error:', error);
        throw new Error('Failed to create question');
      }

      res.status(201).json({
        success: true,
        message: 'Question created successfully',
        data: question
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all questions with filters
   */
  static async getQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        question_type,
        subject,
        topic,
        difficulty_level,
        tags,
        search,
        page = 1,
        limit = 20
      } = req.query;

      let query = supabaseAdmin
        .from('questions')
        .select('*, users!questions_created_by_fkey(full_name)', { count: 'exact' })
        .eq('is_active', true);

      if (question_type) {
        query = query.eq('question_type', question_type);
      }

      if (subject) {
        query = query.eq('subject', subject);
      }

      if (topic) {
        query = query.eq('topic', topic);
      }

      if (difficulty_level) {
        query = query.eq('difficulty_level', difficulty_level);
      }

      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        query = query.contains('tags', tagArray);
      }

      if (search) {
        query = query.ilike('question_text', `%${search}%`);
      }

      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      const { data: questions, error, count } = await query;

      if (error) {
        logger.error('Get questions error:', error);
        throw new Error('Failed to fetch questions');
      }

      res.json({
        success: true,
        message: 'Questions retrieved successfully',
        data: questions,
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
   * Get question by ID
   */
  static async getQuestionById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const { data: question, error } = await supabaseAdmin
        .from('questions')
        .select('*, users!questions_created_by_fkey(full_name)')
        .eq('id', id)
        .single();

      if (error || !question) {
        throw new NotFoundError('Question not found');
      }

      res.json({
        success: true,
        message: 'Question retrieved successfully',
        data: question
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update question
   */
  static async updateQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if question exists and user has permission
      const { data: existingQuestion, error: fetchError } = await supabaseAdmin
        .from('questions')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !existingQuestion) {
        throw new NotFoundError('Question not found');
      }

      // Only creator or admin can update
      if (existingQuestion.created_by !== userId && userRole !== 'admin') {
        throw new ValidationError('You do not have permission to update this question');
      }

      const {
        question_type,
        question_text,
        question_image_url,
        difficulty_level,
        subject,
        topic,
        marks,
        negative_marks,
        options,
        correct_answers,
        explanation,
        tags,
        is_active
      } = req.body;

      const updateData: any = {};
      if (question_type !== undefined) updateData.question_type = question_type;
      if (question_text !== undefined) updateData.question_text = question_text;
      if (question_image_url !== undefined) updateData.question_image_url = question_image_url;
      if (difficulty_level !== undefined) updateData.difficulty_level = difficulty_level;
      if (subject !== undefined) updateData.subject = subject;
      if (topic !== undefined) updateData.topic = topic;
      if (marks !== undefined) updateData.marks = marks;
      if (negative_marks !== undefined) updateData.negative_marks = negative_marks;
      if (options !== undefined) updateData.options = options;
      if (correct_answers !== undefined) updateData.correct_answers = correct_answers;
      if (explanation !== undefined) updateData.explanation = explanation;
      if (tags !== undefined) updateData.tags = tags;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { data: question, error } = await supabaseAdmin
        .from('questions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Update question error:', error);
        throw new Error('Failed to update question');
      }

      res.json({
        success: true,
        message: 'Question updated successfully',
        data: question
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete question
   */
  static async deleteQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if question exists and user has permission
      const { data: existingQuestion, error: fetchError } = await supabaseAdmin
        .from('questions')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !existingQuestion) {
        throw new NotFoundError('Question not found');
      }

      // Only creator or admin can delete
      if (existingQuestion.created_by !== userId && userRole !== 'admin') {
        throw new ValidationError('You do not have permission to delete this question');
      }

      // Soft delete - set is_active to false
      const { error } = await supabaseAdmin
        .from('questions')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        logger.error('Delete question error:', error);
        throw new Error('Failed to delete question');
      }

      res.json({
        success: true,
        message: 'Question deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk delete questions
   */
  static async bulkDeleteQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question_ids } = req.body;

      if (!Array.isArray(question_ids) || question_ids.length === 0) {
        throw new ValidationError('question_ids must be a non-empty array');
      }

      const { error } = await supabaseAdmin
        .from('questions')
        .update({ is_active: false })
        .in('id', question_ids);

      if (error) {
        logger.error('Bulk delete questions error:', error);
        throw new Error('Failed to delete questions');
      }

      res.json({
        success: true,
        message: `${question_ids.length} questions deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unique subjects
   */
  static async getSubjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { data: questions, error } = await supabaseAdmin
        .from('questions')
        .select('subject')
        .eq('is_active', true)
        .not('subject', 'is', null);

      if (error) {
        logger.error('Get subjects error:', error);
        throw new Error('Failed to fetch subjects');
      }

      const subjects = [...new Set(questions.map(q => q.subject))].sort();

      res.json({
        success: true,
        message: 'Subjects retrieved successfully',
        data: subjects
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unique topics for a subject
   */
  static async getTopics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subject } = req.query;

      let query = supabaseAdmin
        .from('questions')
        .select('topic')
        .eq('is_active', true)
        .not('topic', 'is', null);

      if (subject) {
        query = query.eq('subject', subject);
      }

      const { data: questions, error } = await query;

      if (error) {
        logger.error('Get topics error:', error);
        throw new Error('Failed to fetch topics');
      }

      const topics = [...new Set(questions.map(q => q.topic))].sort();

      res.json({
        success: true,
        message: 'Topics retrieved successfully',
        data: topics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get question statistics
   */
  static async getStatistics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      let query = supabaseAdmin
        .from('questions')
        .select('question_type, difficulty_level, subject', { count: 'exact' })
        .eq('is_active', true);

      // If teacher, only show their questions
      if (userRole === 'teacher') {
        query = query.eq('created_by', userId);
      }

      const { data: questions, count } = await query;

      const stats = {
        total: count || 0,
        byType: {} as Record<string, number>,
        byDifficulty: {} as Record<string, number>,
        bySubject: {} as Record<string, number>
      };

      questions?.forEach(q => {
        // Count by type
        stats.byType[q.question_type] = (stats.byType[q.question_type] || 0) + 1;

        // Count by difficulty
        if (q.difficulty_level) {
          stats.byDifficulty[q.difficulty_level] = (stats.byDifficulty[q.difficulty_level] || 0) + 1;
        }

        // Count by subject
        if (q.subject) {
          stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
        }
      });

      res.json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}
