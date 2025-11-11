import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { AttemptStatus } from '../types';

export class ExamAttemptController {
  /**
   * Start an exam attempt
   */
  static async startAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { exam_id, schedule_id, pre_exam_photo_url, pre_exam_id_photo_url, system_info } = req.body;

      // Check if exam and schedule exist
      const { data: schedule, error: scheduleError } = await supabaseAdmin
        .from('exam_schedules')
        .select('*, exams(*)')
        .eq('id', schedule_id)
        .eq('exam_id', exam_id)
        .single();

      if (scheduleError || !schedule) {
        throw new NotFoundError('Exam schedule not found');
      }

      // Check if exam is published
      if (schedule.exams.status !== 'published') {
        throw new ValidationError('This exam is not available');
      }

      // Check if exam is within schedule time
      const now = new Date();
      const startTime = new Date(schedule.start_time);
      const endTime = new Date(schedule.end_time);

      if (now < startTime) {
        throw new ValidationError('Exam has not started yet');
      }

      if (now > endTime) {
        throw new ValidationError('Exam has ended');
      }

      // Check if student is allowed
      if (schedule.allowed_students && !schedule.allowed_students.includes(userId!)) {
        throw new ValidationError('You are not allowed to take this exam');
      }

      // Check previous attempts
      const { data: previousAttempts, error: attemptsError } = await supabaseAdmin
        .from('exam_attempts')
        .select('attempt_number')
        .eq('exam_id', exam_id)
        .eq('student_id', userId)
        .order('attempt_number', { ascending: false });

      if (attemptsError) {
        logger.error('Get attempts error:', attemptsError);
      }

      const attemptNumber = previousAttempts && previousAttempts.length > 0
        ? previousAttempts[0].attempt_number + 1
        : 1;

      // Check max attempts
      if (attemptNumber > schedule.max_attempts) {
        throw new ValidationError(`Maximum ${schedule.max_attempts} attempts allowed`);
      }

      // Check if there's an ongoing attempt
      const { data: ongoingAttempt } = await supabaseAdmin
        .from('exam_attempts')
        .select('id')
        .eq('exam_id', exam_id)
        .eq('student_id', userId)
        .eq('status', AttemptStatus.IN_PROGRESS)
        .single();

      if (ongoingAttempt) {
        throw new ValidationError('You already have an ongoing attempt for this exam');
      }

      // Create attempt
      const { data: attempt, error } = await supabaseAdmin
        .from('exam_attempts')
        .insert({
          exam_id,
          schedule_id,
          student_id: userId,
          attempt_number: attemptNumber,
          started_at: new Date().toISOString(),
          time_remaining_seconds: schedule.exams.duration_minutes * 60,
          status: AttemptStatus.IN_PROGRESS,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          proctoring_verified: !!pre_exam_photo_url,
          pre_exam_photo_url,
          pre_exam_id_photo_url,
          system_info
        })
        .select(`
          *,
          exams(
            id,
            title,
            duration_minutes,
            total_marks,
            instructions,
            proctoring_enabled,
            randomize_questions,
            randomize_options,
            allow_review
          )
        `)
        .single();

      if (error) {
        logger.error('Start attempt error:', error);
        throw new Error('Failed to start exam attempt');
      }

      // Get exam questions
      let questionsQuery = supabaseAdmin
        .from('exam_questions')
        .select(`
          id,
          question_order,
          marks_override,
          negative_marks_override,
          questions(
            id,
            question_type,
            question_text,
            question_image_url,
            difficulty_level,
            marks,
            negative_marks,
            options
          )
        `)
        .eq('exam_id', exam_id);

      // Randomize if enabled
      if (schedule.exams.randomize_questions) {
        // Note: Random ordering would be better done at DB level or with additional logic
        questionsQuery = questionsQuery.order('question_order', { ascending: true });
      } else {
        questionsQuery = questionsQuery.order('question_order', { ascending: true });
      }

      const { data: examQuestions, error: questionsError } = await questionsQuery;

      if (questionsError) {
        logger.error('Get exam questions error:', questionsError);
        throw new Error('Failed to fetch exam questions');
      }

      // If randomize options is enabled, shuffle options for MCQ questions
      const questions = examQuestions.map(eq => {
        const question = { ...eq.questions };
        if (schedule.exams.randomize_options && question.options) {
          question.options = [...question.options].sort(() => Math.random() - 0.5);
        }
        return {
          ...eq,
          question
        };
      });

      res.status(201).json({
        success: true,
        message: 'Exam attempt started successfully',
        data: {
          attempt,
          questions
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current attempt details
   */
  static async getAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const { data: attempt, error } = await supabaseAdmin
        .from('exam_attempts')
        .select(`
          *,
          exams(*),
          exam_responses(
            id,
            question_id,
            response,
            is_marked_for_review,
            visited_at,
            answered_at
          )
        `)
        .eq('id', id)
        .single();

      if (error || !attempt) {
        throw new NotFoundError('Exam attempt not found');
      }

      // Check if user owns this attempt
      if (attempt.student_id !== userId) {
        throw new ValidationError('You do not have permission to view this attempt');
      }

      res.json({
        success: true,
        message: 'Attempt retrieved successfully',
        data: attempt
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit answer for a question
   */
  static async submitAnswer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params; // attempt_id
      const { question_id, response, is_marked_for_review, time_spent_seconds } = req.body;
      const userId = req.user?.id;

      // Verify attempt belongs to user and is in progress
      const { data: attempt, error: attemptError } = await supabaseAdmin
        .from('exam_attempts')
        .select('student_id, status')
        .eq('id', id)
        .single();

      if (attemptError || !attempt) {
        throw new NotFoundError('Exam attempt not found');
      }

      if (attempt.student_id !== userId) {
        throw new ValidationError('You do not have permission to submit answers for this attempt');
      }

      if (attempt.status !== AttemptStatus.IN_PROGRESS) {
        throw new ValidationError('This exam attempt is not active');
      }

      // Check if response already exists
      const { data: existingResponse } = await supabaseAdmin
        .from('exam_responses')
        .select('id')
        .eq('attempt_id', id)
        .eq('question_id', question_id)
        .single();

      let result;

      if (existingResponse) {
        // Update existing response
        const { data, error } = await supabaseAdmin
          .from('exam_responses')
          .update({
            response,
            is_marked_for_review: is_marked_for_review || false,
            time_spent_seconds: time_spent_seconds || 0,
            answered_at: response ? new Date().toISOString() : null
          })
          .eq('id', existingResponse.id)
          .select()
          .single();

        if (error) {
          logger.error('Update response error:', error);
          throw new Error('Failed to update answer');
        }

        result = data;
      } else {
        // Create new response
        const { data, error } = await supabaseAdmin
          .from('exam_responses')
          .insert({
            attempt_id: id,
            question_id,
            response,
            is_marked_for_review: is_marked_for_review || false,
            time_spent_seconds: time_spent_seconds || 0,
            visited_at: new Date().toISOString(),
            answered_at: response ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (error) {
          logger.error('Submit answer error:', error);
          throw new Error('Failed to submit answer');
        }

        result = data;
      }

      res.json({
        success: true,
        message: 'Answer saved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit/finish exam attempt
   */
  static async submitAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { time_remaining_seconds } = req.body;

      // Verify attempt
      const { data: attempt, error: attemptError } = await supabaseAdmin
        .from('exam_attempts')
        .select('student_id, status, exam_id')
        .eq('id', id)
        .single();

      if (attemptError || !attempt) {
        throw new NotFoundError('Exam attempt not found');
      }

      if (attempt.student_id !== userId) {
        throw new ValidationError('You do not have permission to submit this attempt');
      }

      if (attempt.status !== AttemptStatus.IN_PROGRESS) {
        throw new ValidationError('This exam attempt is already submitted');
      }

      // Update attempt status
      const { error } = await supabaseAdmin
        .from('exam_attempts')
        .update({
          status: AttemptStatus.SUBMITTED,
          submitted_at: new Date().toISOString(),
          time_remaining_seconds: time_remaining_seconds || 0
        })
        .eq('id', id);

      if (error) {
        logger.error('Submit attempt error:', error);
        throw new Error('Failed to submit exam');
      }

      // Trigger evaluation (will be done in evaluation controller)
      // For now, just return success

      res.json({
        success: true,
        message: 'Exam submitted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get student's attempts for an exam
   */
  static async getStudentAttempts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { examId } = req.params;
      const userId = req.user?.id;

      const { data: attempts, error } = await supabaseAdmin
        .from('exam_attempts')
        .select(`
          id,
          attempt_number,
          started_at,
          submitted_at,
          status,
          exam_results(
            final_score,
            percentage,
            pass_status,
            rank
          )
        `)
        .eq('exam_id', examId)
        .eq('student_id', userId)
        .order('attempt_number', { ascending: false });

      if (error) {
        logger.error('Get student attempts error:', error);
        throw new Error('Failed to fetch attempts');
      }

      res.json({
        success: true,
        message: 'Attempts retrieved successfully',
        data: attempts
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all attempts for an exam (Teacher/Admin)
   */
  static async getExamAttempts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { examId } = req.params;
      const { status, page = 1, limit = 20 } = req.query;

      let query = supabaseAdmin
        .from('exam_attempts')
        .select(`
          *,
          users!exam_attempts_student_id_fkey(full_name, email),
          exam_results(
            final_score,
            percentage,
            pass_status
          )
        `, { count: 'exact' })
        .eq('exam_id', examId);

      if (status) {
        query = query.eq('status', status);
      }

      const offset = (Number(page) - 1) * Number(limit);
      query = query
        .order('started_at', { ascending: false })
        .range(offset, offset + Number(limit) - 1);

      const { data: attempts, error, count } = await query;

      if (error) {
        logger.error('Get exam attempts error:', error);
        throw new Error('Failed to fetch exam attempts');
      }

      res.json({
        success: true,
        message: 'Exam attempts retrieved successfully',
        data: attempts,
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
   * Auto-submit attempt when time expires
   */
  static async autoSubmitAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from('exam_attempts')
        .update({
          status: AttemptStatus.AUTO_SUBMITTED,
          submitted_at: new Date().toISOString(),
          time_remaining_seconds: 0
        })
        .eq('id', id)
        .eq('status', AttemptStatus.IN_PROGRESS);

      if (error) {
        logger.error('Auto-submit attempt error:', error);
        throw new Error('Failed to auto-submit exam');
      }

      res.json({
        success: true,
        message: 'Exam auto-submitted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Terminate attempt due to violations
   */
  static async terminateAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const { error } = await supabaseAdmin
        .from('exam_attempts')
        .update({
          status: AttemptStatus.TERMINATED,
          submitted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Terminate attempt error:', error);
        throw new Error('Failed to terminate exam');
      }

      // Log termination reason
      logger.warn(`Attempt ${id} terminated. Reason: ${reason}`);

      res.json({
        success: true,
        message: 'Exam attempt terminated'
      });
    } catch (error) {
      next(error);
    }
  }
}
