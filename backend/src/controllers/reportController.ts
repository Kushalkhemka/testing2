import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';

export class ReportController {
  /**
   * Get individual student performance report
   */
  static async getStudentReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { student_id, exam_id } = req.params;

      // Get exam results
      const { data: result, error } = await supabaseAdmin
        .from('exam_results')
        .select(`
          *,
          exam_attempts(
            started_at,
            submitted_at,
            attempt_number
          ),
          exams(
            title,
            subject,
            total_marks,
            passing_marks
          ),
          users!exam_results_student_id_fkey(
            full_name,
            email
          )
        `)
        .eq('student_id', student_id)
        .eq('exam_id', exam_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !result) {
        throw new NotFoundError('Result not found');
      }

      // Get question-wise performance
      const { data: responses } = await supabaseAdmin
        .from('exam_responses')
        .select(`
          question_id,
          response,
          marks_obtained,
          time_spent_seconds,
          questions(
            question_text,
            question_type,
            subject,
            topic,
            difficulty_level,
            marks
          )
        `)
        .eq('attempt_id', result.attempt_id);

      // Get proctoring summary
      const { data: violations } = await supabaseAdmin
        .from('proctoring_events')
        .select('event_type, severity, timestamp')
        .eq('attempt_id', result.attempt_id);

      const report = {
        student: result.users,
        exam: result.exams,
        attempt: result.exam_attempts,
        overall_performance: {
          final_score: result.final_score,
          percentage: result.percentage,
          grade: result.grade,
          pass_status: result.pass_status,
          rank: result.rank,
          total_questions: result.total_questions,
          attempted_questions: result.attempted_questions,
          correct_answers: result.correct_answers,
          incorrect_answers: result.incorrect_answers,
          time_taken: result.time_taken_seconds
        },
        subject_wise_performance: result.subject_wise_performance,
        question_wise_performance: responses,
        proctoring: {
          violations_count: result.proctoring_violations_count,
          proctoring_score: result.proctoring_score,
          violations: violations
        },
        strengths_and_weaknesses: this.analyzeStrengthsWeaknesses(responses || [])
      };

      res.json({
        success: true,
        message: 'Student report generated successfully',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get class-wise performance report for an exam
   */
  static async getClassReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exam_id } = req.params;

      // Get exam details
      const { data: exam, error: examError } = await supabaseAdmin
        .from('exams')
        .select('*')
        .eq('id', exam_id)
        .single();

      if (examError || !exam) {
        throw new NotFoundError('Exam not found');
      }

      // Get all results for this exam
      const { data: results, error: resultsError } = await supabaseAdmin
        .from('exam_results')
        .select(`
          *,
          users!exam_results_student_id_fkey(
            full_name,
            email
          )
        `)
        .eq('exam_id', exam_id)
        .order('final_score', { ascending: false });

      if (resultsError) {
        logger.error('Get class results error:', resultsError);
        throw new Error('Failed to fetch class results');
      }

      const totalStudents = results.length;
      const passedStudents = results.filter(r => r.pass_status).length;
      const failedStudents = totalStudents - passedStudents;

      // Calculate statistics
      const scores = results.map(r => r.final_score);
      const averageScore = scores.reduce((a, b) => a + b, 0) / totalStudents || 0;
      const maxScore = Math.max(...scores, 0);
      const minScore = Math.min(...scores, Infinity);
      const medianScore = this.calculateMedian(scores);

      // Score distribution
      const scoreRanges = [
        { range: '0-20', count: 0 },
        { range: '21-40', count: 0 },
        { range: '41-60', count: 0 },
        { range: '61-80', count: 0 },
        { range: '81-100', count: 0 }
      ];

      results.forEach(r => {
        const percentage = r.percentage;
        if (percentage <= 20) scoreRanges[0].count++;
        else if (percentage <= 40) scoreRanges[1].count++;
        else if (percentage <= 60) scoreRanges[2].count++;
        else if (percentage <= 80) scoreRanges[3].count++;
        else scoreRanges[4].count++;
      });

      // Question-wise analysis
      const questionAnalysis = await this.getQuestionWiseAnalysis(exam_id);

      // Top performers
      const topPerformers = results.slice(0, 10).map(r => ({
        student_name: r.users.full_name,
        email: r.users.email,
        score: r.final_score,
        percentage: r.percentage,
        rank: r.rank
      }));

      const report = {
        exam: {
          id: exam.id,
          title: exam.title,
          subject: exam.subject,
          total_marks: exam.total_marks,
          passing_marks: exam.passing_marks
        },
        statistics: {
          total_students: totalStudents,
          passed: passedStudents,
          failed: failedStudents,
          pass_percentage: (passedStudents / totalStudents) * 100,
          average_score: Math.round(averageScore * 100) / 100,
          median_score: medianScore,
          highest_score: maxScore,
          lowest_score: minScore === Infinity ? 0 : minScore
        },
        score_distribution: scoreRanges,
        question_analysis: questionAnalysis,
        top_performers: topPerformers,
        detailed_results: results.map(r => ({
          student_name: r.users.full_name,
          email: r.users.email,
          score: r.final_score,
          percentage: r.percentage,
          pass_status: r.pass_status,
          attempted_questions: r.attempted_questions,
          correct_answers: r.correct_answers,
          proctoring_score: r.proctoring_score
        }))
      };

      res.json({
        success: true,
        message: 'Class report generated successfully',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get proctoring report for an exam
   */
  static async getProctoringReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exam_id } = req.params;

      // Get all attempts for the exam
      const { data: attempts, error } = await supabaseAdmin
        .from('exam_attempts')
        .select(`
          id,
          student_id,
          status,
          users!exam_attempts_student_id_fkey(full_name, email)
        `)
        .eq('exam_id', exam_id);

      if (error) {
        logger.error('Get attempts error:', error);
        throw new Error('Failed to fetch attempts');
      }

      // Get violations for all attempts
      const attemptIds = attempts.map(a => a.id);
      const { data: allViolations } = await supabaseAdmin
        .from('proctoring_events')
        .select('*')
        .in('attempt_id', attemptIds);

      // Compile report
      const studentsWithViolations = attempts.map(attempt => {
        const violations = allViolations?.filter(v => v.attempt_id === attempt.id) || [];

        const violationsByType: Record<string, number> = {};
        const violationsBySeverity = {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        };

        violations.forEach(v => {
          violationsByType[v.event_type] = (violationsByType[v.event_type] || 0) + 1;
          violationsBySeverity[v.severity as keyof typeof violationsBySeverity]++;
        });

        let proctoringScore = 100;
        proctoringScore -= violationsBySeverity.critical * 25;
        proctoringScore -= violationsBySeverity.high * 10;
        proctoringScore -= violationsBySeverity.medium * 5;
        proctoringScore = Math.max(0, proctoringScore);

        return {
          student: attempt.users,
          attempt_id: attempt.id,
          status: attempt.status,
          total_violations: violations.length,
          violations_by_severity: violationsBySeverity,
          violations_by_type: violationsByType,
          proctoring_score: proctoringScore,
          risk_level:
            violationsBySeverity.critical > 0
              ? 'High'
              : violationsBySeverity.high > 2
              ? 'Medium'
              : 'Low'
        };
      });

      // Sort by violations count
      studentsWithViolations.sort((a, b) => b.total_violations - a.total_violations);

      // Overall statistics
      const totalViolations = allViolations?.length || 0;
      const highRiskStudents = studentsWithViolations.filter(s => s.risk_level === 'High').length;
      const mediumRiskStudents = studentsWithViolations.filter(s => s.risk_level === 'Medium').length;

      const report = {
        overall_statistics: {
          total_attempts: attempts.length,
          total_violations: totalViolations,
          high_risk_students: highRiskStudents,
          medium_risk_students: mediumRiskStudents,
          average_violations_per_student:
            Math.round((totalViolations / attempts.length) * 100) / 100
        },
        students: studentsWithViolations,
        flagged_students: studentsWithViolations.filter(s => s.risk_level !== 'Low')
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
   * Get detailed evaluation report
   */
  static async getEvaluationReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { exam_id } = req.params;

      // Get all results
      const { data: results } = await supabaseAdmin
        .from('exam_results')
        .select(`
          *,
          users!exam_results_student_id_fkey(full_name, email)
        `)
        .eq('exam_id', exam_id);

      const totalResults = results?.length || 0;
      const aiEvaluated = results?.filter(r => r.ai_evaluated).length || 0;
      const manuallyReviewed = results?.filter(r => r.manually_reviewed).length || 0;

      // Get pending evaluations
      const { data: pendingResponses } = await supabaseAdmin
        .from('exam_responses')
        .select(`
          id,
          attempt_id,
          questions(question_type),
          exam_attempts!inner(exam_id, users!exam_attempts_student_id_fkey(full_name))
        `)
        .eq('exam_attempts.exam_id', exam_id)
        .is('marks_obtained', null);

      const report = {
        evaluation_summary: {
          total_submissions: totalResults,
          ai_evaluated: aiEvaluated,
          manually_reviewed: manuallyReviewed,
          pending_evaluation: pendingResponses?.length || 0
        },
        pending_responses: pendingResponses?.map(r => ({
          response_id: r.id,
          attempt_id: r.attempt_id,
          student_name: r.exam_attempts?.users?.full_name,
          question_type: r.questions?.question_type
        })),
        evaluation_status_by_student: results?.map(r => ({
          student: r.users.full_name,
          email: r.users.email,
          ai_evaluated: r.ai_evaluated,
          manually_reviewed: r.manually_reviewed,
          final_score: r.final_score
        }))
      };

      res.json({
        success: true,
        message: 'Evaluation report generated successfully',
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  static async getDashboardAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      let examQuery = supabaseAdmin.from('exams').select('id, status');

      if (userRole === 'teacher') {
        examQuery = examQuery.eq('created_by', userId);
      }

      const { data: exams } = await examQuery;
      const examIds = exams?.map(e => e.id) || [];

      // Get total statistics
      const { data: totalAttempts } = await supabaseAdmin
        .from('exam_attempts')
        .select('id')
        .in('exam_id', examIds);

      const { data: totalQuestions } = await supabaseAdmin
        .from('questions')
        .select('id')
        .eq('is_active', true);

      const { data: recentResults } = await supabaseAdmin
        .from('exam_results')
        .select(`
          final_score,
          percentage,
          created_at,
          exams(title)
        `)
        .in('exam_id', examIds)
        .order('created_at', { ascending: false })
        .limit(10);

      const analytics = {
        overview: {
          total_exams: exams?.length || 0,
          published_exams: exams?.filter(e => e.status === 'published').length || 0,
          draft_exams: exams?.filter(e => e.status === 'draft').length || 0,
          total_attempts: totalAttempts?.length || 0,
          total_questions: totalQuestions?.length || 0
        },
        recent_results: recentResults,
        exam_status_distribution: {
          draft: exams?.filter(e => e.status === 'draft').length || 0,
          published: exams?.filter(e => e.status === 'published').length || 0,
          archived: exams?.filter(e => e.status === 'archived').length || 0
        }
      };

      res.json({
        success: true,
        message: 'Dashboard analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Analyze strengths and weaknesses
   */
  private static analyzeStrengthsWeaknesses(responses: any[]): any {
    const byTopic: Record<string, { correct: number; total: number }> = {};
    const byDifficulty: Record<string, { correct: number; total: number }> = {};

    responses.forEach(r => {
      const question = r.questions;
      if (!question) return;

      const isCorrect = r.marks_obtained > 0;

      // By topic
      if (question.topic) {
        if (!byTopic[question.topic]) {
          byTopic[question.topic] = { correct: 0, total: 0 };
        }
        byTopic[question.topic].total++;
        if (isCorrect) byTopic[question.topic].correct++;
      }

      // By difficulty
      if (question.difficulty_level) {
        if (!byDifficulty[question.difficulty_level]) {
          byDifficulty[question.difficulty_level] = { correct: 0, total: 0 };
        }
        byDifficulty[question.difficulty_level].total++;
        if (isCorrect) byDifficulty[question.difficulty_level].correct++;
      }
    });

    // Calculate percentages
    const topicPerformance = Object.entries(byTopic).map(([topic, stats]) => ({
      topic,
      correct: stats.correct,
      total: stats.total,
      percentage: (stats.correct / stats.total) * 100
    }));

    const difficultyPerformance = Object.entries(byDifficulty).map(([level, stats]) => ({
      difficulty: level,
      correct: stats.correct,
      total: stats.total,
      percentage: (stats.correct / stats.total) * 100
    }));

    // Identify strengths (>75%) and weaknesses (<50%)
    const strengths = topicPerformance.filter(t => t.percentage >= 75);
    const weaknesses = topicPerformance.filter(t => t.percentage < 50);

    return {
      by_topic: topicPerformance,
      by_difficulty: difficultyPerformance,
      strengths,
      weaknesses
    };
  }

  /**
   * Helper: Calculate median
   */
  private static calculateMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Helper: Get question-wise analysis
   */
  private static async getQuestionWiseAnalysis(examId: string): Promise<any[]> {
    const { data: examQuestions } = await supabaseAdmin
      .from('exam_questions')
      .select(`
        question_id,
        questions(question_text, question_type, marks)
      `)
      .eq('exam_id', examId);

    if (!examQuestions) return [];

    const analysis = await Promise.all(
      examQuestions.map(async eq => {
        const { data: responses } = await supabaseAdmin
          .from('exam_responses')
          .select(`
            marks_obtained,
            exam_attempts!inner(exam_id)
          `)
          .eq('question_id', eq.question_id)
          .eq('exam_attempts.exam_id', examId);

        const totalAttempts = responses?.length || 0;
        const correctAnswers = responses?.filter(r => r.marks_obtained > 0).length || 0;
        const averageMarks =
          totalAttempts > 0
            ? responses!.reduce((sum, r) => sum + (r.marks_obtained || 0), 0) / totalAttempts
            : 0;

        return {
          question_text: eq.questions?.question_text,
          question_type: eq.questions?.question_type,
          max_marks: eq.questions?.marks,
          total_attempts: totalAttempts,
          correct_answers: correctAnswers,
          accuracy: totalAttempts > 0 ? (correctAnswers / totalAttempts) * 100 : 0,
          average_marks: Math.round(averageMarks * 100) / 100
        };
      })
    );

    return analysis;
  }
}
