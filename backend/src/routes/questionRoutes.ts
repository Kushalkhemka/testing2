import express from 'express';
import { body } from 'express-validator';
import { QuestionController } from '../controllers/questionController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all questions
router.get('/', QuestionController.getQuestions);

// Get question by ID
router.get('/:id', QuestionController.getQuestionById);

// Get subjects
router.get('/meta/subjects', QuestionController.getSubjects);

// Get topics
router.get('/meta/topics', QuestionController.getTopics);

// Get statistics
router.get('/meta/statistics', QuestionController.getStatistics);

// Create question (Teacher/Admin only)
router.post(
  '/',
  isTeacherOrAdmin,
  validate([
    body('question_type').notEmpty().withMessage('Question type is required'),
    body('question_text').notEmpty().withMessage('Question text is required'),
    body('correct_answers').isArray().withMessage('Correct answers must be an array')
  ]),
  QuestionController.createQuestion
);

// Update question (Teacher/Admin only)
router.put('/:id', isTeacherOrAdmin, QuestionController.updateQuestion);

// Delete question (Teacher/Admin only)
router.delete('/:id', isTeacherOrAdmin, QuestionController.deleteQuestion);

// Bulk delete questions (Teacher/Admin only)
router.post(
  '/bulk-delete',
  isTeacherOrAdmin,
  validate([
    body('question_ids').isArray().withMessage('question_ids must be an array')
  ]),
  QuestionController.bulkDeleteQuestions
);

export default router;
