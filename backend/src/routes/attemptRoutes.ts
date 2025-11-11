import express from 'express';
import { body } from 'express-validator';
import { ExamAttemptController } from '../controllers/examAttemptController';
import { authenticate, isTeacherOrAdmin, isStudent } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Start exam attempt (Student only)
router.post(
  '/start',
  isStudent,
  validate([
    body('exam_id').notEmpty().withMessage('Exam ID is required'),
    body('schedule_id').notEmpty().withMessage('Schedule ID is required')
  ]),
  ExamAttemptController.startAttempt
);

// Get attempt details
router.get('/:id', ExamAttemptController.getAttempt);

// Submit answer for a question
router.post(
  '/:id/answers',
  isStudent,
  validate([
    body('question_id').notEmpty().withMessage('Question ID is required')
  ]),
  ExamAttemptController.submitAnswer
);

// Submit/finish exam
router.post('/:id/submit', isStudent, ExamAttemptController.submitAttempt);

// Auto-submit attempt (when time expires)
router.post('/:id/auto-submit', ExamAttemptController.autoSubmitAttempt);

// Terminate attempt (Teacher/Admin only)
router.post(
  '/:id/terminate',
  isTeacherOrAdmin,
  validate([
    body('reason').notEmpty().withMessage('Termination reason is required')
  ]),
  ExamAttemptController.terminateAttempt
);

// Get student's attempts for an exam
router.get('/exam/:examId/student', ExamAttemptController.getStudentAttempts);

// Get all attempts for an exam (Teacher/Admin only)
router.get('/exam/:examId/all', isTeacherOrAdmin, ExamAttemptController.getExamAttempts);

export default router;
