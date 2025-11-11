import express from 'express';
import { body } from 'express-validator';
import { ExamController } from '../controllers/examController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all exams
router.get('/', ExamController.getExams);

// Get exam by ID
router.get('/:id', ExamController.getExamById);

// Create exam (Teacher/Admin only)
router.post(
  '/',
  isTeacherOrAdmin,
  validate([
    body('title').notEmpty().withMessage('Title is required'),
    body('duration_minutes').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('total_marks').isFloat({ min: 0 }).withMessage('Total marks must be a positive number')
  ]),
  ExamController.createExam
);

// Update exam (Teacher/Admin only)
router.put('/:id', isTeacherOrAdmin, ExamController.updateExam);

// Delete exam (Teacher/Admin only)
router.delete('/:id', isTeacherOrAdmin, ExamController.deleteExam);

// Add questions to exam (Teacher/Admin only)
router.post(
  '/:id/questions',
  isTeacherOrAdmin,
  validate([
    body('questions').isArray().withMessage('questions must be an array')
  ]),
  ExamController.addQuestions
);

// Remove question from exam (Teacher/Admin only)
router.delete('/:id/questions/:questionId', isTeacherOrAdmin, ExamController.removeQuestion);

// Reorder questions (Teacher/Admin only)
router.put(
  '/:id/questions/reorder',
  isTeacherOrAdmin,
  validate([
    body('question_orders').isArray().withMessage('question_orders must be an array')
  ]),
  ExamController.reorderQuestions
);

// Create exam schedule (Teacher/Admin only)
router.post(
  '/:id/schedules',
  isTeacherOrAdmin,
  validate([
    body('start_time').isISO8601().withMessage('Valid start time is required'),
    body('end_time').isISO8601().withMessage('Valid end time is required')
  ]),
  ExamController.createSchedule
);

// Get exam schedules
router.get('/:id/schedules', ExamController.getSchedules);

// Publish exam (Teacher/Admin only)
router.post('/:id/publish', isTeacherOrAdmin, ExamController.publishExam);

export default router;
