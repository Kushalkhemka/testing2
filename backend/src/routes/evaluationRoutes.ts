import express from 'express';
import { body } from 'express-validator';
import { EvaluationController } from '../controllers/evaluationController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = express.Router();

// All routes require authentication and teacher/admin role
router.use(authenticate, isTeacherOrAdmin);

// Evaluate single response
router.post('/response/:response_id', EvaluationController.evaluateResponse);

// Evaluate entire attempt
router.post('/attempt/:attempt_id', EvaluationController.evaluateAttempt);

// Manual evaluation override
router.put(
  '/response/:response_id/manual',
  validate([
    body('marks_obtained').isNumeric().withMessage('Marks must be a number'),
    body('feedback').optional().isString().withMessage('Feedback must be a string')
  ]),
  EvaluationController.manualEvaluation
);

// Get evaluation status
router.get('/attempt/:attempt_id/status', EvaluationController.getEvaluationStatus);

export default router;
