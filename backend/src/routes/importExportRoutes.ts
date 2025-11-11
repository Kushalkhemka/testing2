import express from 'express';
import multer from 'multer';
import { ImportExportController } from '../controllers/importExportController';
import { authenticate, isTeacherOrAdmin } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/json', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JSON, CSV, and Excel files are allowed.'));
    }
  }
});

// All routes require authentication and teacher/admin role
router.use(authenticate, isTeacherOrAdmin);

// Import questions from file
router.post('/import', upload.single('file'), ImportExportController.importQuestions);

// Export questions to file
router.post('/export', ImportExportController.exportQuestions);

// Get import history
router.get('/import-history', ImportExportController.getImportHistory);

// Download template
router.get('/template', ImportExportController.downloadTemplate);

export default router;
