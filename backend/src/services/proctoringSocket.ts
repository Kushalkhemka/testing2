import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/auth';
import { supabaseAdmin } from '../config/supabase';
import logger from '../config/logger';

interface ProctoringUser {
  userId: string;
  attemptId: string;
  socketId: string;
  examId: string;
}

// Store active proctoring sessions
const activeSessions = new Map<string, ProctoringUser>();

export const setupProctoringSocket = (io: SocketIOServer): void => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      socket.data.userId = decoded.userId;
      socket.data.userRole = decoded.role;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`User ${userId} connected via Socket.IO`);

    // Join proctoring session
    socket.on('join-proctoring', async (data: { attemptId: string; examId: string }) => {
      try {
        const { attemptId, examId } = data;

        // Verify attempt belongs to user
        const { data: attempt, error } = await supabaseAdmin
          .from('exam_attempts')
          .select('id, student_id, status')
          .eq('id', attemptId)
          .eq('student_id', userId)
          .single();

        if (error || !attempt || attempt.status !== 'in_progress') {
          socket.emit('proctoring-error', {
            message: 'Invalid attempt or exam not in progress'
          });
          return;
        }

        // Store session
        const session: ProctoringUser = {
          userId,
          attemptId,
          socketId: socket.id,
          examId
        };

        activeSessions.set(socket.id, session);
        socket.join(`attempt:${attemptId}`);
        socket.join(`exam:${examId}`);

        logger.info(`User ${userId} joined proctoring for attempt ${attemptId}`);

        socket.emit('proctoring-joined', {
          message: 'Successfully joined proctoring session',
          attemptId
        });

        // Notify teachers/admins monitoring this exam
        socket.to(`exam:${examId}-monitors`).emit('student-joined-exam', {
          studentId: userId,
          attemptId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Join proctoring error:', error);
        socket.emit('proctoring-error', {
          message: 'Failed to join proctoring session'
        });
      }
    });

    // Receive proctoring video frame
    socket.on('proctoring-frame', async (data: {
      attemptId: string;
      frameData: string; // Base64 encoded image
      timestamp: number;
    }) => {
      try {
        const session = activeSessions.get(socket.id);

        if (!session || session.attemptId !== data.attemptId) {
          socket.emit('proctoring-error', {
            message: 'Invalid proctoring session'
          });
          return;
        }

        // Forward to monitoring teachers/admins
        socket.to(`exam:${session.examId}-monitors`).emit('student-frame', {
          studentId: session.userId,
          attemptId: data.attemptId,
          frameData: data.frameData,
          timestamp: data.timestamp
        });

        // Here you would typically:
        // 1. Save frame to storage (if needed)
        // 2. Run AI detection for violations
        // 3. Store violations in database

        socket.emit('frame-received', {
          timestamp: data.timestamp
        });
      } catch (error) {
        logger.error('Proctoring frame error:', error);
      }
    });

    // Receive proctoring event (detected by client-side AI)
    socket.on('proctoring-event', async (data: {
      attemptId: string;
      eventType: string;
      severity: string;
      description?: string;
      evidence?: string;
      metadata?: any;
    }) => {
      try {
        const session = activeSessions.get(socket.id);

        if (!session || session.attemptId !== data.attemptId) {
          socket.emit('proctoring-error', {
            message: 'Invalid proctoring session'
          });
          return;
        }

        // Store event in database
        const { error } = await supabaseAdmin
          .from('proctoring_events')
          .insert({
            attempt_id: data.attemptId,
            event_type: data.eventType,
            severity: data.severity,
            description: data.description,
            evidence_url: data.evidence,
            metadata: data.metadata,
            timestamp: new Date().toISOString(),
            auto_flagged: true,
            reviewed: false
          });

        if (error) {
          logger.error('Store proctoring event error:', error);
        }

        // Notify monitoring teachers/admins
        socket.to(`exam:${session.examId}-monitors`).emit('proctoring-violation', {
          studentId: session.userId,
          attemptId: data.attemptId,
          eventType: data.eventType,
          severity: data.severity,
          description: data.description,
          timestamp: new Date().toISOString()
        });

        socket.emit('event-recorded', {
          message: 'Event recorded successfully'
        });

        // Check if attempt should be terminated
        if (data.severity === 'critical') {
          await checkAndTerminateAttempt(data.attemptId, socket, session);
        }
      } catch (error) {
        logger.error('Proctoring event error:', error);
      }
    });

    // Screen share data
    socket.on('screen-data', async (data: {
      attemptId: string;
      screenData: string;
      timestamp: number;
    }) => {
      try {
        const session = activeSessions.get(socket.id);

        if (!session || session.attemptId !== data.attemptId) {
          return;
        }

        // Forward to monitors
        socket.to(`exam:${session.examId}-monitors`).emit('student-screen', {
          studentId: session.userId,
          attemptId: data.attemptId,
          screenData: data.screenData,
          timestamp: data.timestamp
        });
      } catch (error) {
        logger.error('Screen data error:', error);
      }
    });

    // Audio data (for suspicious sound detection)
    socket.on('audio-event', async (data: {
      attemptId: string;
      audioLevel: number;
      hasSpeech: boolean;
      timestamp: number;
    }) => {
      try {
        const session = activeSessions.get(socket.id);

        if (!session || session.attemptId !== data.attemptId) {
          return;
        }

        // If suspicious audio detected
        if (data.hasSpeech || data.audioLevel > 0.7) {
          await supabaseAdmin
            .from('proctoring_events')
            .insert({
              attempt_id: data.attemptId,
              event_type: data.hasSpeech ? 'suspicious_audio' : 'background_noise',
              severity: 'medium',
              description: `Audio level: ${data.audioLevel}`,
              metadata: { audioLevel: data.audioLevel, hasSpeech: data.hasSpeech },
              timestamp: new Date().toISOString(),
              auto_flagged: true,
              reviewed: false
            });

          socket.to(`exam:${session.examId}-monitors`).emit('audio-violation', {
            studentId: session.userId,
            attemptId: data.attemptId,
            audioLevel: data.audioLevel,
            hasSpeech: data.hasSpeech
          });
        }
      } catch (error) {
        logger.error('Audio event error:', error);
      }
    });

    // Teacher/Admin monitor exam
    socket.on('monitor-exam', async (data: { examId: string }) => {
      try {
        // Only allow teachers and admins
        if (socket.data.userRole !== 'teacher' && socket.data.userRole !== 'admin') {
          socket.emit('monitor-error', {
            message: 'Unauthorized to monitor exams'
          });
          return;
        }

        socket.join(`exam:${data.examId}-monitors`);

        logger.info(`User ${userId} started monitoring exam ${data.examId}`);

        socket.emit('monitoring-started', {
          message: 'Successfully started monitoring exam',
          examId: data.examId
        });

        // Send list of active students in this exam
        const activeStu = Array.from(activeSessions.values()).filter(
          s => s.examId === data.examId
        );

        socket.emit('active-students', {
          students: activeStu.map(s => ({
            userId: s.userId,
            attemptId: s.attemptId
          }))
        });
      } catch (error) {
        logger.error('Monitor exam error:', error);
      }
    });

    // Stop monitoring
    socket.on('stop-monitor', (data: { examId: string }) => {
      socket.leave(`exam:${data.examId}-monitors`);
      logger.info(`User ${userId} stopped monitoring exam ${data.examId}`);
    });

    // Leave proctoring session
    socket.on('leave-proctoring', () => {
      const session = activeSessions.get(socket.id);

      if (session) {
        socket.leave(`attempt:${session.attemptId}`);
        socket.leave(`exam:${session.examId}`);
        activeSessions.delete(socket.id);

        socket.to(`exam:${session.examId}-monitors`).emit('student-left-exam', {
          studentId: session.userId,
          attemptId: session.attemptId,
          timestamp: new Date().toISOString()
        });

        logger.info(`User ${userId} left proctoring session`);
      }
    });

    // Heartbeat to keep connection alive
    socket.on('heartbeat', () => {
      socket.emit('heartbeat-ack', { timestamp: Date.now() });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const session = activeSessions.get(socket.id);

      if (session) {
        activeSessions.delete(socket.id);

        socket.to(`exam:${session.examId}-monitors`).emit('student-disconnected', {
          studentId: session.userId,
          attemptId: session.attemptId,
          timestamp: new Date().toISOString()
        });

        logger.info(`User ${userId} disconnected from proctoring`);
      }
    });
  });
};

// Helper function to check and terminate attempt
async function checkAndTerminateAttempt(
  attemptId: string,
  socket: Socket,
  session: ProctoringUser
): Promise<void> {
  try {
    const { data: events } = await supabaseAdmin
      .from('proctoring_events')
      .select('severity')
      .eq('attempt_id', attemptId);

    const criticalCount = events?.filter(e => e.severity === 'critical').length || 0;

    // Terminate if more than 2 critical violations
    if (criticalCount >= 3) {
      await supabaseAdmin
        .from('exam_attempts')
        .update({
          status: 'terminated',
          submitted_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      socket.emit('attempt-terminated', {
        message: 'Your exam has been terminated due to multiple violations',
        reason: 'Multiple critical proctoring violations detected'
      });

      socket.to(`exam:${session.examId}-monitors`).emit('attempt-terminated-notification', {
        studentId: session.userId,
        attemptId,
        reason: 'Multiple critical violations'
      });

      // Force disconnect
      socket.disconnect(true);

      logger.warn(`Attempt ${attemptId} auto-terminated due to ${criticalCount} critical violations`);
    }
  } catch (error) {
    logger.error('Check and terminate attempt error:', error);
  }
}
