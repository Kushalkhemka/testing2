import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { ProctoringEventType, EventSeverity, RecordingType } from '../types';

export class ProctoringController {
  /**
   * Record a proctoring event
   */
  static async recordEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        attempt_id,
        event_type,
        severity,
        description,
        evidence_url,
        metadata
      } = req.body;

      // Validate event type
      if (!Object.values(ProctoringEventType).includes(event_type)) {
        throw new ValidationError('Invalid event type');
      }

      // Validate severity
      if (severity && !Object.values(EventSeverity).includes(severity)) {
        throw new ValidationError('Invalid severity level');
      }

      // Create proctoring event
      const { data: event, error } = await supabaseAdmin
        .from('proctoring_events')
        .insert({
          attempt_id,
          event_type,
          severity: severity || EventSeverity.MEDIUM,
          description,
          evidence_url,
          metadata,
          timestamp: new Date().toISOString(),
          auto_flagged: true,
          reviewed: false
        })
        .select()
        .single();

      if (error) {
        logger.error('Record proctoring event error:', error);
        throw new Error('Failed to record proctoring event');
      }

      // Check if we should terminate the attempt based on severity and count
      if (severity === EventSeverity.CRITICAL) {
        await this.checkAndTerminateAttempt(attempt_id);
      }

      res.status(201).json({
        success: true,
        message: 'Proctoring event recorded successfully',
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proctoring events for an attempt
   */
  static async getAttemptEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = req.params;
      const { event_type, severity, reviewed } = req.query;

      let query = supabaseAdmin
        .from('proctoring_events')
        .select('*')
        .eq('attempt_id', attemptId);

      if (event_type) {
        query = query.eq('event_type', event_type);
      }

      if (severity) {
        query = query.eq('severity', severity);
      }

      if (reviewed !== undefined) {
        query = query.eq('reviewed', reviewed === 'true');
      }

      query = query.order('timestamp', { ascending: false });

      const { data: events, error } = await query;

      if (error) {
        logger.error('Get proctoring events error:', error);
        throw new Error('Failed to fetch proctoring events');
      }

      // Get event statistics
      const stats = {
        total: events.length,
        bySeverity: {
          low: events.filter(e => e.severity === EventSeverity.LOW).length,
          medium: events.filter(e => e.severity === EventSeverity.MEDIUM).length,
          high: events.filter(e => e.severity === EventSeverity.HIGH).length,
          critical: events.filter(e => e.severity === EventSeverity.CRITICAL).length
        },
        reviewed: events.filter(e => e.reviewed).length,
        unreviewed: events.filter(e => !e.reviewed).length
      };

      res.json({
        success: true,
        message: 'Proctoring events retrieved successfully',
        data: {
          events,
          statistics: stats
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Review a proctoring event
   */
  static async reviewEvent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { action_taken } = req.body;

      const { data: event, error } = await supabaseAdmin
        .from('proctoring_events')
        .update({
          reviewed: true,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          action_taken
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Review proctoring event error:', error);
        throw new Error('Failed to review proctoring event');
      }

      res.json({
        success: true,
        message: 'Proctoring event reviewed successfully',
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Store proctoring recording metadata
   */
  static async storeRecording(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        attempt_id,
        recording_type,
        file_url,
        duration_seconds,
        file_size_bytes,
        start_timestamp,
        end_timestamp,
        metadata
      } = req.body;

      // Validate recording type
      if (!Object.values(RecordingType).includes(recording_type)) {
        throw new ValidationError('Invalid recording type');
      }

      const { data: recording, error } = await supabaseAdmin
        .from('proctoring_recordings')
        .insert({
          attempt_id,
          recording_type,
          file_url,
          duration_seconds,
          file_size_bytes,
          start_timestamp,
          end_timestamp,
          metadata
        })
        .select()
        .single();

      if (error) {
        logger.error('Store recording error:', error);
        throw new Error('Failed to store recording metadata');
      }

      res.status(201).json({
        success: true,
        message: 'Recording metadata stored successfully',
        data: recording
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proctoring recordings for an attempt
   */
  static async getRecordings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = req.params;
      const { recording_type } = req.query;

      let query = supabaseAdmin
        .from('proctoring_recordings')
        .select('*')
        .eq('attempt_id', attemptId);

      if (recording_type) {
        query = query.eq('recording_type', recording_type);
      }

      query = query.order('start_timestamp', { ascending: true });

      const { data: recordings, error } = await query;

      if (error) {
        logger.error('Get recordings error:', error);
        throw new Error('Failed to fetch recordings');
      }

      res.json({
        success: true,
        message: 'Recordings retrieved successfully',
        data: recordings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proctoring summary for an attempt
   */
  static async getProctoringReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = req.params;

      // Get attempt details
      const { data: attempt, error: attemptError } = await supabaseAdmin
        .from('exam_attempts')
        .select(`
          id,
          started_at,
          submitted_at,
          status,
          proctoring_verified,
          users!exam_attempts_student_id_fkey(full_name, email),
          exams(title)
        `)
        .eq('id', attemptId)
        .single();

      if (attemptError || !attempt) {
        throw new NotFoundError('Exam attempt not found');
      }

      // Get all events
      const { data: events } = await supabaseAdmin
        .from('proctoring_events')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('timestamp', { ascending: true });

      // Get recordings
      const { data: recordings } = await supabaseAdmin
        .from('proctoring_recordings')
        .select('*')
        .eq('attempt_id', attemptId);

      // Calculate proctoring score
      const totalEvents = events?.length || 0;
      const criticalEvents = events?.filter(e => e.severity === EventSeverity.CRITICAL).length || 0;
      const highEvents = events?.filter(e => e.severity === EventSeverity.HIGH).length || 0;
      const mediumEvents = events?.filter(e => e.severity === EventSeverity.MEDIUM).length || 0;

      // Scoring logic: Start with 100, deduct points for violations
      let proctoringScore = 100;
      proctoringScore -= criticalEvents * 25;
      proctoringScore -= highEvents * 10;
      proctoringScore -= mediumEvents * 5;
      proctoringScore = Math.max(0, proctoringScore);

      // Event timeline
      const timeline = events?.map(e => ({
        timestamp: e.timestamp,
        event_type: e.event_type,
        severity: e.severity,
        description: e.description
      })) || [];

      // Group events by type
      const eventsByType: Record<string, number> = {};
      events?.forEach(e => {
        eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
      });

      const report = {
        attempt,
        summary: {
          total_events: totalEvents,
          critical_events: criticalEvents,
          high_events: highEvents,
          medium_events: mediumEvents,
          low_events: events?.filter(e => e.severity === EventSeverity.LOW).length || 0,
          proctoring_score: proctoringScore,
          risk_level: criticalEvents > 0 ? 'High' : highEvents > 2 ? 'Medium' : 'Low',
          recordings_count: recordings?.length || 0
        },
        events_by_type: eventsByType,
        timeline,
        recordings: recordings?.map(r => ({
          recording_type: r.recording_type,
          duration_seconds: r.duration_seconds,
          file_url: r.file_url
        }))
      };

      res.json({
        success: true,
        message: 'Proctoring report generated successfully',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all flagged attempts for an exam
   */
  static async getFlaggedAttempts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { examId } = req.params;
      const { severity_threshold = 'medium' } = req.query;

      // Get all attempts with high violation counts
      const { data: attempts, error } = await supabaseAdmin
        .from('exam_attempts')
        .select(`
          id,
          student_id,
          started_at,
          submitted_at,
          status,
          users!exam_attempts_student_id_fkey(full_name, email)
        `)
        .eq('exam_id', examId);

      if (error) {
        logger.error('Get flagged attempts error:', error);
        throw new Error('Failed to fetch flagged attempts');
      }

      // Get violation counts for each attempt
      const flaggedAttempts = await Promise.all(
        attempts.map(async (attempt) => {
          const { data: events } = await supabaseAdmin
            .from('proctoring_events')
            .select('severity')
            .eq('attempt_id', attempt.id);

          const violations = {
            critical: events?.filter(e => e.severity === EventSeverity.CRITICAL).length || 0,
            high: events?.filter(e => e.severity === EventSeverity.HIGH).length || 0,
            medium: events?.filter(e => e.severity === EventSeverity.MEDIUM).length || 0,
            total: events?.length || 0
          };

          return {
            ...attempt,
            violations
          };
        })
      );

      // Filter based on severity threshold
      const filtered = flaggedAttempts.filter(attempt => {
        if (severity_threshold === 'critical') {
          return attempt.violations.critical > 0;
        } else if (severity_threshold === 'high') {
          return attempt.violations.critical > 0 || attempt.violations.high > 0;
        } else {
          return attempt.violations.total > 5; // More than 5 violations of any type
        }
      });

      res.json({
        success: true,
        message: 'Flagged attempts retrieved successfully',
        data: filtered
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper method to check and terminate attempt if violations exceed threshold
   */
  private static async checkAndTerminateAttempt(attemptId: string): Promise<void> {
    try {
      const { data: events } = await supabaseAdmin
        .from('proctoring_events')
        .select('severity')
        .eq('attempt_id', attemptId);

      const criticalCount = events?.filter(e => e.severity === EventSeverity.CRITICAL).length || 0;

      // Terminate if more than 2 critical violations
      if (criticalCount >= 3) {
        await supabaseAdmin
          .from('exam_attempts')
          .update({
            status: 'terminated',
            submitted_at: new Date().toISOString()
          })
          .eq('id', attemptId);

        logger.warn(`Attempt ${attemptId} auto-terminated due to ${criticalCount} critical violations`);
      }
    } catch (error) {
      logger.error('Check and terminate attempt error:', error);
    }
  }

  /**
   * Bulk review events
   */
  static async bulkReviewEvents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { event_ids, action_taken } = req.body;

      if (!Array.isArray(event_ids) || event_ids.length === 0) {
        throw new ValidationError('event_ids must be a non-empty array');
      }

      const { error } = await supabaseAdmin
        .from('proctoring_events')
        .update({
          reviewed: true,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          action_taken
        })
        .in('id', event_ids);

      if (error) {
        logger.error('Bulk review events error:', error);
        throw new Error('Failed to review events');
      }

      res.json({
        success: true,
        message: `${event_ids.length} events reviewed successfully`
      });
    } catch (error) {
      next(error);
    }
  }
}
