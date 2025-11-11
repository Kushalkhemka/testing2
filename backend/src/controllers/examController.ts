import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { ExamStatus, UserRole } from '../types';

export class ExamController {
  /**
   * Create a new exam
   */
  static async createExam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const {
        title,
        description,
        subject,
        duration_minutes,
        total_marks,
        passing_marks,
        negative_marking_enabled,
        randomize_questions,
        randomize_options,
        show_results_immediately,
        allow_review,
        proctoring_enabled,
        proctoring_strictness,
        instructions,
        questions // Array of {question_id, marks_override, negative_marks_override}
      } = req.body;

      // Create exam
      const { data: exam, error: examError } = await supabaseAdmin
        .from('exams')
        .insert({
          created_by: userId,
          title,
          description,
          subject,
          duration_minutes,
          total_marks,
          passing_marks,
          negative_marking_enabled: negative_marking_enabled || false,
          randomize_questions: randomize_questions || false,
          randomize_options: randomize_options || false,
          show_results_immediately: show_results_immediately || false,
          allow_review: allow_review !== undefined ? allow_review : true,
          proctoring_enabled: proctoring_enabled !== undefined ? proctoring_enabled : true,
          proctoring_strictness: proctoring_strictness || 'medium',
          instructions,
          status: ExamStatus.DRAFT
        })
        .select()
        .single();

      if (examError || !exam) {
        logger.error('Create exam error:', examError);
        throw new Error('Failed to create exam');
      }

      // Add questions to exam if provided
      if (questions && Array.isArray(questions) && questions.length > 0) {
        const examQuestions = questions.map((q, index) => ({
          exam_id: exam.id,
          question_id: q.question_id,
          question_order: index + 1,
          marks_override: q.marks_override,
          negative_marks_override: q.negative_marks_override
        }));

        const { error: questionsError } = await supabaseAdmin
          .from('exam_questions')
          .insert(examQuestions);

        if (questionsError) {
          logger.error('Add exam questions error:', questionsError);
          // Rollback exam creation
          await supabaseAdmin.from('exams').delete().eq('id', exam.id);
          throw new Error('Failed to add questions to exam');
        }
      }

      res.status(201).json({
        success: true,
        message: 'Exam created successfully',
        data: exam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all exams with filters
   */
  static async getExams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { status, subject, search, page = 1, limit = 10 } = req.query;

      let query = supabaseAdmin
        .from('exams')
        .select('*, users!exams_created_by_fkey(full_name)', { count: 'exact' });

      // Teachers can only see their own exams
      if (userRole === UserRole.TEACHER) {
        query = query.eq('created_by', userId);
      }

      // Students can only see published exams
      if (userRole === UserRole.STUDENT) {
        query = query.eq('status', ExamStatus.PUBLISHED);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (subject) {
        query = query.eq('subject', subject);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      const { data: exams, error, count } = await query;

      if (error) {
        logger.error('Get exams error:', error);
        throw new Error('Failed to fetch exams');
      }

      res.json({
        success: true,
        message: 'Exams retrieved successfully',
        data: exams,
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
   * Get exam by ID with full details
   */
  static async getExamById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const { data: exam, error } = await supabaseAdmin
        .from('exams')
        .select(`
          *,
          users!exams_created_by_fkey(full_name),
          exam_questions(
            id,
            question_order,
            marks_override,
            negative_marks_override,
            questions(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error || !exam) {
        throw new NotFoundError('Exam not found');
      }

      // Check permissions
      if (
        userRole === UserRole.TEACHER &&
        exam.created_by !== userId
      ) {
        throw new ValidationError('You do not have permission to view this exam');
      }

      if (userRole === UserRole.STUDENT && exam.status !== ExamStatus.PUBLISHED) {
        throw new ValidationError('This exam is not available');
      }

      res.json({
        success: true,
        message: 'Exam retrieved successfully',
        data: exam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update exam
   */
  static async updateExam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if exam exists and user has permission
      const { data: existingExam, error: fetchError } = await supabaseAdmin
        .from('exams')
        .select('created_by, status')
        .eq('id', id)
        .single();

      if (fetchError || !existingExam) {
        throw new NotFoundError('Exam not found');
      }

      if (existingExam.created_by !== userId && userRole !== UserRole.ADMIN) {
        throw new ValidationError('You do not have permission to update this exam');
      }

      const updateData: any = {};
      const allowedFields = [
        'title', 'description', 'subject', 'duration_minutes', 'total_marks',
        'passing_marks', 'negative_marking_enabled', 'randomize_questions',
        'randomize_options', 'show_results_immediately', 'allow_review',
        'proctoring_enabled', 'proctoring_strictness', 'instructions', 'status'
      ];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const { data: exam, error } = await supabaseAdmin
        .from('exams')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Update exam error:', error);
        throw new Error('Failed to update exam');
      }

      res.json({
        success: true,
        message: 'Exam updated successfully',
        data: exam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete exam
   */
  static async deleteExam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      // Check if exam exists and user has permission
      const { data: existingExam, error: fetchError } = await supabaseAdmin
        .from('exams')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !existingExam) {
        throw new NotFoundError('Exam not found');
      }

      if (existingExam.created_by !== userId && userRole !== UserRole.ADMIN) {
        throw new ValidationError('You do not have permission to delete this exam');
      }

      // Archive instead of hard delete
      const { error } = await supabaseAdmin
        .from('exams')
        .update({ status: ExamStatus.ARCHIVED })
        .eq('id', id);

      if (error) {
        logger.error('Delete exam error:', error);
        throw new Error('Failed to delete exam');
      }

      res.json({
        success: true,
        message: 'Exam deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add questions to exam
   */
  static async addQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { questions } = req.body;

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new ValidationError('questions must be a non-empty array');
      }

      // Get current max question order
      const { data: existingQuestions } = await supabaseAdmin
        .from('exam_questions')
        .select('question_order')
        .eq('exam_id', id)
        .order('question_order', { ascending: false })
        .limit(1);

      const startOrder = existingQuestions && existingQuestions.length > 0
        ? existingQuestions[0].question_order + 1
        : 1;

      const examQuestions = questions.map((q, index) => ({
        exam_id: id,
        question_id: q.question_id,
        question_order: startOrder + index,
        marks_override: q.marks_override,
        negative_marks_override: q.negative_marks_override
      }));

      const { data, error } = await supabaseAdmin
        .from('exam_questions')
        .insert(examQuestions)
        .select();

      if (error) {
        logger.error('Add questions error:', error);
        throw new Error('Failed to add questions to exam');
      }

      res.json({
        success: true,
        message: 'Questions added successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove question from exam
   */
  static async removeQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, questionId } = req.params;

      const { error } = await supabaseAdmin
        .from('exam_questions')
        .delete()
        .eq('exam_id', id)
        .eq('question_id', questionId);

      if (error) {
        logger.error('Remove question error:', error);
        throw new Error('Failed to remove question from exam');
      }

      res.json({
        success: true,
        message: 'Question removed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorder questions in exam
   */
  static async reorderQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { question_orders } = req.body; // Array of {exam_question_id, new_order}

      if (!Array.isArray(question_orders)) {
        throw new ValidationError('question_orders must be an array');
      }

      // Update each question order
      const updates = question_orders.map(item =>
        supabaseAdmin
          .from('exam_questions')
          .update({ question_order: item.new_order })
          .eq('id', item.exam_question_id)
          .eq('exam_id', id)
      );

      await Promise.all(updates);

      res.json({
        success: true,
        message: 'Questions reordered successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create exam schedule
   */
  static async createSchedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const {
        schedule_name,
        start_time,
        end_time,
        allowed_students,
        max_attempts
      } = req.body;

      // Validate dates
      const start = new Date(start_time);
      const end = new Date(end_time);

      if (start >= end) {
        throw new ValidationError('End time must be after start time');
      }

      const { data: schedule, error } = await supabaseAdmin
        .from('exam_schedules')
        .insert({
          exam_id: id,
          schedule_name,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          allowed_students: allowed_students || null,
          max_attempts: max_attempts || 1
        })
        .select()
        .single();

      if (error) {
        logger.error('Create schedule error:', error);
        throw new Error('Failed to create exam schedule');
      }

      res.status(201).json({
        success: true,
        message: 'Exam schedule created successfully',
        data: schedule
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get exam schedules
   */
  static async getSchedules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const { data: schedules, error } = await supabaseAdmin
        .from('exam_schedules')
        .select('*')
        .eq('exam_id', id)
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('Get schedules error:', error);
        throw new Error('Failed to fetch exam schedules');
      }

      res.json({
        success: true,
        message: 'Exam schedules retrieved successfully',
        data: schedules
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publish exam
   */
  static async publishExam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Validate exam has questions
      const { data: questions, error: questionsError } = await supabaseAdmin
        .from('exam_questions')
        .select('id')
        .eq('exam_id', id);

      if (questionsError || !questions || questions.length === 0) {
        throw new ValidationError('Cannot publish exam without questions');
      }

      // Validate exam has at least one schedule
      const { data: schedules, error: schedulesError } = await supabaseAdmin
        .from('exam_schedules')
        .select('id')
        .eq('exam_id', id);

      if (schedulesError || !schedules || schedules.length === 0) {
        throw new ValidationError('Cannot publish exam without schedule');
      }

      const { data: exam, error } = await supabaseAdmin
        .from('exams')
        .update({ status: ExamStatus.PUBLISHED })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Publish exam error:', error);
        throw new Error('Failed to publish exam');
      }

      res.json({
        success: true,
        message: 'Exam published successfully',
        data: exam
      });
    } catch (error) {
      next(error);
    }
  }
}
