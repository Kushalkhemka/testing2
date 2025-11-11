import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError } from '../middleware/errorHandler';
import logger from '../config/logger';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';
import { QuestionType, ImportFormat } from '../types';

export class ImportExportController {
  /**
   * Import questions from file
   */
  static async importQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const file = req.file;

      if (!file) {
        throw new ValidationError('No file uploaded');
      }

      const { format = 'json' } = req.body;

      let questions: any[] = [];
      let errorLog: any[] = [];

      // Parse file based on format
      switch (format.toLowerCase()) {
        case 'json':
          questions = await this.parseJSON(file.buffer);
          break;
        case 'csv':
          questions = await this.parseCSV(file.buffer);
          break;
        case 'excel':
          questions = await this.parseExcel(file.buffer);
          break;
        default:
          throw new ValidationError('Unsupported import format');
      }

      // Validate and import questions
      const importResults = await this.validateAndImportQuestions(questions, userId!, errorLog);

      // Store import record
      const { data: importRecord } = await supabaseAdmin
        .from('question_imports')
        .insert({
          imported_by: userId,
          file_name: file.originalname,
          file_url: file.path || '',
          total_questions: questions.length,
          successful_imports: importResults.successful,
          failed_imports: importResults.failed,
          error_log: errorLog.length > 0 ? errorLog : null,
          import_format: format
        })
        .select()
        .single();

      res.status(201).json({
        success: true,
        message: 'Questions imported successfully',
        data: {
          total: questions.length,
          successful: importResults.successful,
          failed: importResults.failed,
          errors: errorLog,
          import_id: importRecord?.id
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export questions to file
   */
  static async exportQuestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format = 'json', question_ids, filters } = req.body;

      let query = supabaseAdmin
        .from('questions')
        .select('*')
        .eq('is_active', true);

      // Apply filters
      if (question_ids && Array.isArray(question_ids)) {
        query = query.in('id', question_ids);
      }

      if (filters) {
        if (filters.subject) query = query.eq('subject', filters.subject);
        if (filters.topic) query = query.eq('topic', filters.topic);
        if (filters.question_type) query = query.eq('question_type', filters.question_type);
        if (filters.difficulty_level) query = query.eq('difficulty_level', filters.difficulty_level);
      }

      const { data: questions, error } = await query;

      if (error) {
        logger.error('Export questions error:', error);
        throw new Error('Failed to fetch questions for export');
      }

      let fileContent: any;
      let contentType: string;
      let fileName: string;

      switch (format.toLowerCase()) {
        case 'json':
          fileContent = JSON.stringify(questions, null, 2);
          contentType = 'application/json';
          fileName = `questions_export_${Date.now()}.json`;
          break;

        case 'csv':
          fileContent = this.convertToCSV(questions);
          contentType = 'text/csv';
          fileName = `questions_export_${Date.now()}.csv`;
          break;

        case 'excel':
          fileContent = this.convertToExcel(questions);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileName = `questions_export_${Date.now()}.xlsx`;
          break;

        default:
          throw new ValidationError('Unsupported export format');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fileContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get import history
   */
  static async getImportHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      let query = supabaseAdmin
        .from('question_imports')
        .select('*, users!question_imports_imported_by_fkey(full_name)')
        .order('created_at', { ascending: false });

      // Teachers can only see their own imports
      if (userRole === 'teacher') {
        query = query.eq('imported_by', userId);
      }

      const { data: imports, error } = await query;

      if (error) {
        logger.error('Get import history error:', error);
        throw new Error('Failed to fetch import history');
      }

      res.json({
        success: true,
        message: 'Import history retrieved successfully',
        data: imports
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download question template
   */
  static async downloadTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { format = 'csv' } = req.query;

      const template = [
        {
          question_type: 'mcq_single',
          question_text: 'What is 2+2?',
          question_image_url: '',
          difficulty_level: 'easy',
          subject: 'Mathematics',
          topic: 'Addition',
          marks: 1,
          negative_marks: 0.25,
          options: JSON.stringify([
            { id: 'A', text: '3', image_url: null },
            { id: 'B', text: '4', image_url: null },
            { id: 'C', text: '5', image_url: null },
            { id: 'D', text: '6', image_url: null }
          ]),
          correct_answers: JSON.stringify(['B']),
          explanation: 'Simple addition: 2+2=4',
          tags: JSON.stringify(['basic', 'arithmetic'])
        }
      ];

      let fileContent: any;
      let contentType: string;
      let fileName: string;

      if (format === 'json') {
        fileContent = JSON.stringify(template, null, 2);
        contentType = 'application/json';
        fileName = 'question_template.json';
      } else if (format === 'excel') {
        fileContent = this.convertToExcel(template);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = 'question_template.xlsx';
      } else {
        fileContent = this.convertToCSV(template);
        contentType = 'text/csv';
        fileName = 'question_template.csv';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(fileContent);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Parse JSON file
   */
  private static async parseJSON(buffer: Buffer): Promise<any[]> {
    try {
      const content = buffer.toString('utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      throw new ValidationError('Invalid JSON format');
    }
  }

  /**
   * Parse CSV file
   */
  private static async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv())
        .on('data', (data) => {
          // Parse JSON fields
          if (data.options) data.options = JSON.parse(data.options);
          if (data.correct_answers) data.correct_answers = JSON.parse(data.correct_answers);
          if (data.tags) data.tags = JSON.parse(data.tags);
          results.push(data);
        })
        .on('end', () => resolve(results))
        .on('error', (error) => reject(new ValidationError('Invalid CSV format')));
    });
  }

  /**
   * Parse Excel file
   */
  private static async parseExcel(buffer: Buffer): Promise<any[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      // Parse JSON fields
      return data.map((row: any) => {
        if (row.options && typeof row.options === 'string') {
          row.options = JSON.parse(row.options);
        }
        if (row.correct_answers && typeof row.correct_answers === 'string') {
          row.correct_answers = JSON.parse(row.correct_answers);
        }
        if (row.tags && typeof row.tags === 'string') {
          row.tags = JSON.parse(row.tags);
        }
        return row;
      });
    } catch (error) {
      throw new ValidationError('Invalid Excel format');
    }
  }

  /**
   * Validate and import questions
   */
  private static async validateAndImportQuestions(
    questions: any[],
    userId: string,
    errorLog: any[]
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      try {
        // Validate required fields
        if (!q.question_type || !q.question_text) {
          throw new Error('Missing required fields: question_type, question_text');
        }

        if (!Object.values(QuestionType).includes(q.question_type)) {
          throw new Error(`Invalid question_type: ${q.question_type}`);
        }

        if (!q.correct_answers || !Array.isArray(q.correct_answers)) {
          throw new Error('correct_answers must be an array');
        }

        // Insert question
        const { error } = await supabaseAdmin.from('questions').insert({
          created_by: userId,
          question_type: q.question_type,
          question_text: q.question_text,
          question_image_url: q.question_image_url || null,
          difficulty_level: q.difficulty_level || null,
          subject: q.subject || null,
          topic: q.topic || null,
          marks: q.marks || 1.0,
          negative_marks: q.negative_marks || 0.0,
          options: q.options || null,
          correct_answers: q.correct_answers,
          explanation: q.explanation || null,
          tags: q.tags || [],
          is_active: true
        });

        if (error) {
          throw error;
        }

        successful++;
      } catch (error: any) {
        failed++;
        errorLog.push({
          row: i + 1,
          question: q.question_text?.substring(0, 50) || 'Unknown',
          error: error.message
        });
        logger.error(`Import error at row ${i + 1}:`, error);
      }
    }

    return { successful, failed };
  }

  /**
   * Convert questions to CSV
   */
  private static convertToCSV(questions: any[]): string {
    if (questions.length === 0) return '';

    const headers = [
      'question_type',
      'question_text',
      'question_image_url',
      'difficulty_level',
      'subject',
      'topic',
      'marks',
      'negative_marks',
      'options',
      'correct_answers',
      'explanation',
      'tags'
    ];

    const csvRows = [headers.join(',')];

    questions.forEach((q) => {
      const row = headers.map((header) => {
        let value = q[header];

        // Stringify objects and arrays
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value).replace(/"/g, '""');
        }

        // Escape commas and quotes
        value = value !== null && value !== undefined ? String(value) : '';
        return `"${value}"`;
      });

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Convert questions to Excel
   */
  private static convertToExcel(questions: any[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(
      questions.map((q) => ({
        ...q,
        options: typeof q.options === 'object' ? JSON.stringify(q.options) : q.options,
        correct_answers:
          typeof q.correct_answers === 'object'
            ? JSON.stringify(q.correct_answers)
            : q.correct_answers,
        tags: typeof q.tags === 'object' ? JSON.stringify(q.tags) : q.tags
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
