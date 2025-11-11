import express from 'express';
import authRoutes from './authRoutes';
import questionRoutes from './questionRoutes';
import examRoutes from './examRoutes';
import attemptRoutes from './attemptRoutes';
import proctoringRoutes from './proctoringRoutes';
import evaluationRoutes from './evaluationRoutes';
import importExportRoutes from './importExportRoutes';
import reportRoutes from './reportRoutes';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Online Examination System API is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/questions', questionRoutes);
router.use('/exams', examRoutes);
router.use('/attempts', attemptRoutes);
router.use('/proctoring', proctoringRoutes);
router.use('/evaluation', evaluationRoutes);
router.use('/import-export', importExportRoutes);
router.use('/reports', reportRoutes);

export default router;
