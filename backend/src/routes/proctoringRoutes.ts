import express from 'express';
import { body } from 'express-validator';
import { ProctoringController } from '../controllers/proctoringController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Record proctoring event
router.post(
  '/events',
  validate([
    body('attempt_id').notEmpty().withMessage('Attempt ID is required'),
    body('event_type').notEmpty().withMessage('Event type is required')
  ]),
  ProctoringController.recordEvent
);

// Get events for an attempt
router.get('/events/attempt/:attemptId', ProctoringController.getAttemptEvents);

// Review proctoring event (Teacher/Admin only)
router.put(
  '/events/:id/review',
  isTeacherOrAdmin,
  validate([
    body('action_taken').notEmpty().withMessage('Action taken is required')
  ]),
  ProctoringController.reviewEvent
);

// Bulk review events (Teacher/Admin only)
router.post(
  '/events/bulk-review',
  isTeacherOrAdmin,
  validate([
    body('event_ids').isArray().withMessage('event_ids must be an array'),
    body('action_taken').notEmpty().withMessage('Action taken is required')
  ]),
  ProctoringController.bulkReviewEvents
);

// Store proctoring recording metadata
router.post(
  '/recordings',
  validate([
    body('attempt_id').notEmpty().withMessage('Attempt ID is required'),
    body('recording_type').notEmpty().withMessage('Recording type is required'),
    body('file_url').notEmpty().withMessage('File URL is required')
  ]),
  ProctoringController.storeRecording
);

// Get recordings for an attempt
router.get('/recordings/attempt/:attemptId', ProctoringController.getRecordings);

// Get proctoring report for an attempt (Teacher/Admin only)
router.get('/report/attempt/:attemptId', isTeacherOrAdmin, ProctoringController.getProctoringReport);

// Get flagged attempts for an exam (Teacher/Admin only)
router.get('/flagged/exam/:examId', isTeacherOrAdmin, ProctoringController.getFlaggedAttempts);

export default router;
