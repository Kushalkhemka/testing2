import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QuestionType } from '../types';

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export class EvaluationController {
  /**
   * Evaluate a single response (mainly for subjective questions)
   */
  static async evaluateResponse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { response_id } = req.params;

      // Get response and question details
      const { data: response, error: responseError } = await supabaseAdmin
        .from('exam_responses')
        .select(`
          *,
          questions(*),
          exam_attempts(exam_id, student_id)
        `)
        .eq('id', response_id)
        .single();

      if (responseError || !response) {
        throw new NotFoundError('Response not found');
      }

      const question = response.questions;
      let marks_obtained = 0;
      let ai_evaluation = null;

      // Evaluate based on question type
      switch (question.question_type) {
        case QuestionType.MCQ_SINGLE:
        case QuestionType.TRUE_FALSE:
          // Auto-evaluate: check if response matches correct answer
          if (
            response.response &&
            response.response.length > 0 &&
            question.correct_answers.includes(response.response[0])
          ) {
            marks_obtained = response.marks_override || question.marks;
          } else {
            marks_obtained = -(response.negative_marks_override || question.negative_marks || 0);
          }
          break;

        case QuestionType.MCQ_MULTIPLE:
          // Check if all correct answers are selected and no incorrect ones
          if (response.response && Array.isArray(response.response)) {
            const correctAnswers = question.correct_answers.sort();
            const studentAnswers = response.response.sort();

            if (JSON.stringify(correctAnswers) === JSON.stringify(studentAnswers)) {
              marks_obtained = response.marks_override || question.marks;
            } else {
              // Partial marking logic (optional)
              marks_obtained = -(response.negative_marks_override || question.negative_marks || 0);
            }
          }
          break;

        case QuestionType.SUBJECTIVE:
        case QuestionType.FILL_BLANK:
          // Use AI for evaluation
          if (genAI && response.response) {
            try {
              const evaluation = await this.evaluateSubjectiveWithAI(
                question.question_text,
                question.correct_answers[0] || '',
                response.response.text || response.response,
                question.marks
              );

              marks_obtained = evaluation.score;
              ai_evaluation = {
                score: evaluation.score,
                feedback: evaluation.feedback,
                model: 'gemini-2.5-pro'
              };
            } catch (aiError) {
              logger.error('AI evaluation error:', aiError);
              // Fallback: require manual evaluation
              marks_obtained = 0;
              ai_evaluation = {
                score: 0,
                feedback: 'AI evaluation failed. Manual review required.',
                model: 'gemini-2.5-pro'
              };
            }
          } else {
            // No AI available, require manual evaluation
            marks_obtained = 0;
          }
          break;

        default:
          marks_obtained = 0;
      }

      // Update response with evaluation
      const { data: updatedResponse, error: updateError } = await supabaseAdmin
        .from('exam_responses')
        .update({
          marks_obtained,
          ai_evaluation,
          evaluated_at: new Date().toISOString()
        })
        .eq('id', response_id)
        .select()
        .single();

      if (updateError) {
        logger.error('Update response error:', updateError);
        throw new Error('Failed to update response evaluation');
      }

      res.json({
        success: true,
        message: 'Response evaluated successfully',
        data: updatedResponse
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Evaluate all responses for an attempt
   */
  static async evaluateAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attempt_id } = req.params;

      // Get attempt details
      const { data: attempt, error: attemptError } = await supabaseAdmin
        .from('exam_attempts')
        .select('id, exam_id, student_id, status')
        .eq('id', attempt_id)
        .single();

      if (attemptError || !attempt) {
        throw new NotFoundError('Exam attempt not found');
      }

      if (attempt.status !== 'submitted' && attempt.status !== 'auto_submitted') {
        throw new ValidationError('Can only evaluate submitted attempts');
      }

      // Get all responses
      const { data: responses, error: responsesError } = await supabaseAdmin
        .from('exam_responses')
        .select(`
          *,
          questions(*),
          exam_questions!inner(marks_override, negative_marks_override)
        `)
        .eq('attempt_id', attempt_id);

      if (responsesError) {
        logger.error('Get responses error:', responsesError);
        throw new Error('Failed to fetch responses');
      }

      let totalMarksObtained = 0;
      let negativeMarks = 0;
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let attemptedQuestions = 0;

      // Evaluate each response
      for (const response of responses) {
        if (!response.response) continue;

        attemptedQuestions++;
        const question = response.questions;
        let marks = 0;
        let isCorrect = false;
        let ai_evaluation = null;

        // Evaluate based on question type
        switch (question.question_type) {
          case QuestionType.MCQ_SINGLE:
          case QuestionType.TRUE_FALSE:
            if (
              response.response.length > 0 &&
              question.correct_answers.includes(response.response[0])
            ) {
              marks = response.exam_questions.marks_override || question.marks;
              isCorrect = true;
              correctAnswers++;
            } else {
              marks = -(response.exam_questions.negative_marks_override || question.negative_marks || 0);
              incorrectAnswers++;
              if (marks < 0) negativeMarks += Math.abs(marks);
            }
            break;

          case QuestionType.MCQ_MULTIPLE:
            const correctAns = question.correct_answers.sort();
            const studentAns = Array.isArray(response.response)
              ? response.response.sort()
              : [];

            if (JSON.stringify(correctAns) === JSON.stringify(studentAns)) {
              marks = response.exam_questions.marks_override || question.marks;
              isCorrect = true;
              correctAnswers++;
            } else {
              marks = -(response.exam_questions.negative_marks_override || question.negative_marks || 0);
              incorrectAnswers++;
              if (marks < 0) negativeMarks += Math.abs(marks);
            }
            break;

          case QuestionType.SUBJECTIVE:
          case QuestionType.FILL_BLANK:
            if (genAI) {
              try {
                const evaluation = await this.evaluateSubjectiveWithAI(
                  question.question_text,
                  question.correct_answers[0] || '',
                  response.response.text || response.response,
                  response.exam_questions.marks_override || question.marks
                );

                marks = evaluation.score;
                ai_evaluation = {
                  score: evaluation.score,
                  feedback: evaluation.feedback,
                  model: 'gemini-2.5-pro'
                };

                if (marks > 0) correctAnswers++;
                else incorrectAnswers++;
              } catch (aiError) {
                logger.error('AI evaluation error for response:', response.id, aiError);
              }
            }
            break;
        }

        // Update response
        await supabaseAdmin
          .from('exam_responses')
          .update({
            marks_obtained: marks,
            ai_evaluation,
            evaluated_at: new Date().toISOString()
          })
          .eq('id', response.id);

        totalMarksObtained += marks;
      }

      // Get exam details for total marks
      const { data: exam } = await supabaseAdmin
        .from('exams')
        .select('total_marks, passing_marks')
        .eq('id', attempt.exam_id)
        .single();

      const finalScore = Math.max(0, totalMarksObtained);
      const percentage = exam ? (finalScore / exam.total_marks) * 100 : 0;
      const passStatus = exam ? finalScore >= (exam.passing_marks || 0) : false;

      // Get proctoring violations count
      const { data: violations } = await supabaseAdmin
        .from('proctoring_events')
        .select('id, severity')
        .eq('attempt_id', attempt_id);

      const violationsCount = violations?.length || 0;
      let proctoringScore = 100;

      if (violations) {
        const critical = violations.filter(v => v.severity === 'critical').length;
        const high = violations.filter(v => v.severity === 'high').length;
        const medium = violations.filter(v => v.severity === 'medium').length;

        proctoringScore -= critical * 25;
        proctoringScore -= high * 10;
        proctoringScore -= medium * 5;
        proctoringScore = Math.max(0, proctoringScore);
      }

      // Calculate time taken
      const { data: attemptDetails } = await supabaseAdmin
        .from('exam_attempts')
        .select('started_at, submitted_at')
        .eq('id', attempt_id)
        .single();

      const timeTaken = attemptDetails
        ? Math.floor(
            (new Date(attemptDetails.submitted_at).getTime() -
              new Date(attemptDetails.started_at).getTime()) /
              1000
          )
        : 0;

      // Create or update exam result
      const { data: existingResult } = await supabaseAdmin
        .from('exam_results')
        .select('id')
        .eq('attempt_id', attempt_id)
        .single();

      const resultData = {
        attempt_id,
        exam_id: attempt.exam_id,
        student_id: attempt.student_id,
        total_questions: responses.length,
        attempted_questions: attemptedQuestions,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        marks_obtained: totalMarksObtained,
        negative_marks: negativeMarks,
        final_score: finalScore,
        percentage: Math.round(percentage * 100) / 100,
        pass_status: passStatus,
        time_taken_seconds: timeTaken,
        proctoring_violations_count: violationsCount,
        proctoring_score: proctoringScore,
        ai_evaluated: true,
        manually_reviewed: false
      };

      let result;
      if (existingResult) {
        const { data, error } = await supabaseAdmin
          .from('exam_results')
          .update(resultData)
          .eq('id', existingResult.id)
          .select()
          .single();

        if (error) {
          logger.error('Update result error:', error);
          throw new Error('Failed to update exam result');
        }
        result = data;
      } else {
        const { data, error } = await supabaseAdmin
          .from('exam_results')
          .insert(resultData)
          .select()
          .single();

        if (error) {
          logger.error('Create result error:', error);
          throw new Error('Failed to create exam result');
        }
        result = data;
      }

      res.json({
        success: true,
        message: 'Attempt evaluated successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manual evaluation override
   */
  static async manualEvaluation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { response_id } = req.params;
      const userId = req.user?.id;
      const { marks_obtained, feedback } = req.body;

      const { data: response, error } = await supabaseAdmin
        .from('exam_responses')
        .update({
          marks_obtained,
          ai_evaluation: {
            score: marks_obtained,
            feedback,
            model: 'manual'
          },
          evaluated_by: userId,
          evaluated_at: new Date().toISOString()
        })
        .eq('id', response_id)
        .select()
        .single();

      if (error) {
        logger.error('Manual evaluation error:', error);
        throw new Error('Failed to update manual evaluation');
      }

      // Recalculate attempt result
      const { data: attemptResponse } = await supabaseAdmin
        .from('exam_responses')
        .select('attempt_id')
        .eq('id', response_id)
        .single();

      if (attemptResponse) {
        await this.recalculateAttemptResult(attemptResponse.attempt_id);
      }

      res.json({
        success: true,
        message: 'Manual evaluation saved successfully',
        data: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * AI evaluation using Gemini for subjective questions
   */
  private static async evaluateSubjectiveWithAI(
    question: string,
    modelAnswer: string,
    studentAnswer: string,
    maxMarks: number
  ): Promise<{ score: number; feedback: string }> {
    if (!genAI) {
      throw new Error('Gemini API key not configured');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `You are an expert examiner evaluating a student's answer for a subjective question.

Question: ${question}

Model/Expected Answer: ${modelAnswer}

Student's Answer: ${studentAnswer}

Maximum Marks: ${maxMarks}

Please evaluate the student's answer and provide:
1. A score out of ${maxMarks} based on correctness, completeness, and relevance
2. Brief feedback explaining the score (2-3 sentences)

Return your evaluation in the following JSON format:
{
  "score": <number between 0 and ${maxMarks}>,
  "feedback": "<your feedback here>"
}`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]);
        return {
          score: Math.min(Math.max(0, evaluation.score), maxMarks),
          feedback: evaluation.feedback || 'No feedback provided'
        };
      }

      // Fallback if JSON parsing fails
      return {
        score: 0,
        feedback: 'Unable to parse AI evaluation. Manual review required.'
      };
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Recalculate attempt result after manual evaluation
   */
  private static async recalculateAttemptResult(attemptId: string): Promise<void> {
    try {
      const { data: responses } = await supabaseAdmin
        .from('exam_responses')
        .select('marks_obtained')
        .eq('attempt_id', attemptId);

      if (!responses) return;

      const totalMarks = responses.reduce((sum, r) => sum + (r.marks_obtained || 0), 0);
      const finalScore = Math.max(0, totalMarks);

      await supabaseAdmin
        .from('exam_results')
        .update({
          marks_obtained: totalMarks,
          final_score: finalScore,
          manually_reviewed: true
        })
        .eq('attempt_id', attemptId);
    } catch (error) {
      logger.error('Recalculate result error:', error);
    }
  }

  /**
   * Get evaluation status for an attempt
   */
  static async getEvaluationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attempt_id } = req.params;

      const { data: responses, error } = await supabaseAdmin
        .from('exam_responses')
        .select(`
          id,
          question_id,
          marks_obtained,
          ai_evaluation,
          evaluated_at,
          questions(question_type, question_text)
        `)
        .eq('attempt_id', attempt_id);

      if (error) {
        logger.error('Get evaluation status error:', error);
        throw new Error('Failed to fetch evaluation status');
      }

      const total = responses.length;
      const evaluated = responses.filter(r => r.marks_obtained !== null).length;
      const pendingManual = responses.filter(
        r => r.marks_obtained === null || (r.ai_evaluation && r.ai_evaluation.score === 0)
      );

      res.json({
        success: true,
        message: 'Evaluation status retrieved successfully',
        data: {
          total_responses: total,
          evaluated: evaluated,
          pending: total - evaluated,
          pending_manual_review: pendingManual.length,
          responses
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
