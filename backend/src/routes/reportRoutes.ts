import express from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get individual student performance report
router.get('/student/:student_id/exam/:exam_id', ReportController.getStudentReport);

// Get class-wise performance report (Teacher/Admin only)
router.get('/class/exam/:exam_id', isTeacherOrAdmin, ReportController.getClassReport);

// Get proctoring report (Teacher/Admin only)
router.get('/proctoring/exam/:exam_id', isTeacherOrAdmin, ReportController.getProctoringReport);

// Get evaluation report (Teacher/Admin only)
router.get('/evaluation/exam/:exam_id', isTeacherOrAdmin, ReportController.getEvaluationReport);

// Get dashboard analytics (Teacher/Admin only)
router.get('/dashboard', isTeacherOrAdmin, ReportController.getDashboardAnalytics);

export default router;
