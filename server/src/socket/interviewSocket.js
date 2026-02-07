/**
 * Interview Socket Handler
 * Real-time WebSocket communication for interview sessions
 * Replaces the Python command-line interface with real-time events
 */

const { Session } = require('../models');
const interviewService = require('../services/interview.service');
const questionService = require('../services/question.service');

/**
 * Initialize Socket.io event handlers
 */
module.exports = function(io) {
  // Store active sessions
  const activeSessions = new Map();

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    /**
     * Join an interview session
     * Client sends: { sessionId: string }
     */
    socket.on('join-session', async (data) => {
      try {
        const { sessionId, isReconnect } = data;

        if (!sessionId) {
          return socket.emit('error', { message: 'Session ID is required' });
        }

        const session = await Session.findById(sessionId);

        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        // Store socket-session mapping
        activeSessions.set(socket.id, sessionId);
        session.socketId = socket.id;
        await session.save();

        // Join socket room for this session
        socket.join(sessionId);

        // Calculate current stats
        const answeredCount = session.answers.filter(a => !a.isSkipped).length;
        const skippedCount = session.answers.filter(a => a.isSkipped).length;
        const totalScore = session.answers.filter(a => !a.isSkipped).reduce((sum, a) => sum + a.score, 0);
        const avgScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;

        // Get the current/last question if this is a reconnect
        let currentQuestion = null;
        if (isReconnect && session.state !== 'INTRO' && session.state !== 'FINISHED') {
          // Find the last unanswered question or get next question
          currentQuestion = session.lastQuestion || null;
        }

        socket.emit('session-joined', {
          sessionId,
          state: session.state,
          userSelectedSkills: session.userSelectedSkills,
          skillsDetected: session.skillsDetected,
          questionsAsked: session.answers.length,
          currentTopic: session.currentTopic,
          totalAnswered: answeredCount,
          totalSkipped: skippedCount,
          averageScore: avgScore,
          currentQuestion: currentQuestion,  // Send current question on reconnect
          isReconnect: isReconnect || false
        });

        console.log(`📝 Socket ${socket.id} joined session ${sessionId}${isReconnect ? ' (RECONNECT)' : ''}`);

      } catch (error) {
        console.error('Error joining session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    /**
     * Start the interview
     * Flow: 
     * - If skills pre-selected: INTRO -> RESUME_WARMUP (skip SKILL_PROMPT)
     * - Legacy flow: INTRO -> SKILL_PROMPT -> (user answers) -> RESUME_WARMUP
     */
    socket.on('start-interview', async () => {
      try {
        const sessionId = activeSessions.get(socket.id);
        if (!sessionId) {
          return socket.emit('error', { message: 'Not in a session' });
        }

        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        // Get intro message
        const intro = await interviewService.getNextQuestion(session);

        socket.emit('interview-message', {
          type: 'intro',
          message: intro.message,
          speakText: intro.speakText || intro.message
        });

        // Check if skills were pre-selected (skipSkillPrompt = true)
        if (intro.skipSkillPrompt) {
          // Skills already known - go directly to first warmup question
          console.log(`🎯 Skills pre-selected: ${intro.detectedSkills.join(', ')}. Skipping skill prompt.`);
          
          // Set flag to prevent duplicate question requests
          socket.isWaitingForIntro = true;
          
          const reloadedSession = await Session.findById(sessionId);
          const firstQuestion = await interviewService.getNextQuestion(reloadedSession);
          
          // Store last question for reconnection recovery
          reloadedSession.lastQuestion = firstQuestion;
          await reloadedSession.save();
          
          // Longer delay to let intro speech complete fully (8 seconds)
          setTimeout(() => {
            socket.isWaitingForIntro = false;
            socket.emit('question', {
              ...firstQuestion,
              speakText: firstQuestion.speakText || firstQuestion.question
            });
            socket.currentQuestion = firstQuestion;
            socket.questionStartTime = Date.now();
          }, 8000);
        } else {
          // Legacy flow: Get the skill prompt question
          const reloadedSession = await Session.findById(sessionId);
          const skillPrompt = await interviewService.getNextQuestion(reloadedSession);
          
          // Store last question for reconnection recovery
          reloadedSession.lastQuestion = skillPrompt;
          await reloadedSession.save();
          
          // Small delay for natural pacing
          setTimeout(() => {
            socket.emit('question', {
              ...skillPrompt,
              type: 'skill_prompt',
              speakText: skillPrompt.speakText || skillPrompt.question
            });
            socket.currentQuestion = skillPrompt;
          }, 1500);
        }

      } catch (error) {
        console.error('Error starting interview:', error);
        socket.emit('error', { message: 'Failed to start interview' });
      }
    });

    /**
     * Request next question
     */
    socket.on('next-question', async () => {
      try {
        // Prevent duplicate calls during intro phase
        if (socket.isWaitingForIntro) {
          console.log('[Socket] Ignoring next-question during intro phase');
          return;
        }

        const sessionId = activeSessions.get(socket.id);
        if (!sessionId) {
          return socket.emit('error', { message: 'Not in a session' });
        }

        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        // Get next question based on current state
        const questionData = await interviewService.getNextQuestion(session);

        if (questionData.type === 'finished') {
          socket.emit('interview-complete', {
            message: questionData.message,
            summary: questionData.summary,
            speakText: questionData.message
          });
          return;
        }

        if (questionData.type === 'transition') {
          socket.emit('interview-message', {
            type: 'transition',
            message: questionData.message,
            speakText: questionData.message
          });
          // Automatically get next question after transition
          const reloadedSession = await Session.findById(sessionId);
          const nextQ = await interviewService.getNextQuestion(reloadedSession);
          
          // Store last question for reconnection recovery
          reloadedSession.lastQuestion = nextQ;
          await reloadedSession.save();
          
          setTimeout(() => {
            socket.emit('question', {
              ...nextQ,
              speakText: nextQ.question
            });
            socket.currentQuestion = nextQ;
            socket.questionStartTime = Date.now();
          }, 2000);
          return;
        }

        // Store last question for reconnection recovery
        session.lastQuestion = questionData;
        await session.save();

        socket.emit('question', {
          ...questionData,
          speakText: questionData.question
        });

        // Store current question for answer processing
        socket.currentQuestion = questionData;
        socket.questionStartTime = Date.now();

      } catch (error) {
        console.error('Error getting next question:', error);
        socket.emit('error', { message: 'Failed to get next question' });
      }
    });

    /**
     * Submit answer (from speech recognition or text input)
     * Client sends: { answer: string, isTranscribed: boolean, detectedSkills?: string[] }
     */
    socket.on('submit-answer', async (data) => {
      try {
        console.log(`🎤 Answer received:`, data);
        
        const sessionId = activeSessions.get(socket.id);
        if (!sessionId) {
          return socket.emit('error', { message: 'Not in a session' });
        }

        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        const { answer, isTranscribed = false, detectedSkills = [] } = data;
        const questionData = socket.currentQuestion;

        console.log(`🎤 Processing answer for session ${sessionId}: "${answer.substring(0, 50)}..."`);

        if (!questionData) {
          console.log(`⚠️ No active question for session ${sessionId}`);
          return socket.emit('error', { message: 'No active question' });
        }

        // SPECIAL HANDLING: Skill prompt answer
        // This is the intro where user says their skills
        if (questionData.type === 'skill_prompt' || questionData.requiresSkillDetection) {
          console.log(`🎯 Processing skill prompt answer. Detected skills: ${detectedSkills.join(', ')}`);
          
          // Process intro and get transition message
          const transitionResult = await interviewService.processIntroAnswer(
            session, 
            answer, 
            detectedSkills
          );
          
          // Send transition message
          socket.emit('interview-message', {
            type: 'transition',
            message: transitionResult.message,
            speakText: transitionResult.speakText,
            detectedSkills: transitionResult.detectedSkills
          });
          
          // Get the first warmup question
          const reloadedSession = await Session.findById(sessionId);
          const firstQuestion = await interviewService.getNextQuestion(reloadedSession);
          
          setTimeout(() => {
            if (firstQuestion.type === 'transition') {
              // If transition, emit it and then get next question
              socket.emit('interview-message', {
                type: 'transition',
                message: firstQuestion.message,
                speakText: firstQuestion.speakText
              });
            } else {
              socket.emit('question', {
                ...firstQuestion,
                speakText: firstQuestion.speakText || firstQuestion.question
              });
              socket.currentQuestion = firstQuestion;
              socket.questionStartTime = Date.now();
            }
          }, 2000);
          
          return;
        }

        // Check for skip command
        const skipPatterns = ['skip', 'next', 'pass', 'next question'];
        const isSkipCommand = skipPatterns.some(p => answer.toLowerCase().includes(p));
        console.log(`[Answer] Skip check - answer: "${answer}", isSkip: ${isSkipCommand}`);
        
        if (isSkipCommand) {
          console.log('[Answer] Processing skip command...');
          const skipResult = await interviewService.skipQuestion(session, questionData);
          
          // Don't reveal the answer on skip - just acknowledge
          socket.emit('answer-result', {
            type: 'skipped',
            message: 'Question skipped.',
            isSkipped: true,
            speakText: '' // Don't speak, just move to next
          });

          // Update question stats
          if (questionData.questionId) {
            await questionService.updateQuestionStats(questionData.questionId, 0);
          }

          // Clear current question
          socket.currentQuestion = null;
          socket.questionStartTime = null;

          // Reload session to get updated counts and send progress
          const updatedSession = await Session.findById(sessionId);
          if (updatedSession) {
            const answeredCount = updatedSession.answers.filter(a => !a.isSkipped).length;
            const skippedCount = updatedSession.answers.filter(a => a.isSkipped).length;
            const totalScore = updatedSession.answers.filter(a => !a.isSkipped).reduce((sum, a) => sum + a.score, 0);
            const avgScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;
            
            console.log(`[Skip] Progress: answered=${answeredCount}, skipped=${skippedCount}, avgScore=${avgScore}`);
            
            socket.emit('progress', {
              state: updatedSession.state,
              currentTopic: updatedSession.currentTopic,
              totalAnswered: answeredCount,
              totalSkipped: skippedCount,
              averageScore: avgScore,
              questionsAsked: updatedSession.answers.length
            });

            // AUTOMATICALLY get and send the next question
            const nextQuestion = await interviewService.getNextQuestion(updatedSession);
            
            if (nextQuestion.type === 'finished') {
              socket.emit('interview-complete', {
                message: nextQuestion.message,
                summary: nextQuestion.summary,
                speakText: nextQuestion.message
              });
            } else if (nextQuestion.type === 'transition') {
              socket.emit('interview-message', {
                type: 'transition',
                message: nextQuestion.message,
                speakText: nextQuestion.speakText || nextQuestion.message
              });
              // Get actual next question after transition
              const afterTransitionSession = await Session.findById(sessionId);
              const actualNext = await interviewService.getNextQuestion(afterTransitionSession);
              
              // Store last question for reconnection recovery
              afterTransitionSession.lastQuestion = actualNext;
              await afterTransitionSession.save();
              
              setTimeout(() => {
                socket.emit('question', {
                  ...actualNext,
                  speakText: actualNext.speakText || actualNext.question
                });
                socket.currentQuestion = actualNext;
                socket.questionStartTime = Date.now();
              }, 2000);
            } else {
              // Store last question for reconnection recovery
              updatedSession.lastQuestion = nextQuestion;
              await updatedSession.save();
              
              // Send next question directly
              socket.emit('question', {
                ...nextQuestion,
                speakText: nextQuestion.speakText || nextQuestion.question
              });
              socket.currentQuestion = nextQuestion;
              socket.questionStartTime = Date.now();
            }
          }

          return;
        }

        // Check for end interview command
        const endPatterns = ['end interview', 'stop interview', 'finish interview', 'quit'];
        if (endPatterns.some(p => answer.toLowerCase().includes(p))) {
          session.state = interviewService.STATES.FINISHED;
          session.endedAt = new Date();
          session.finalScore = session.calculateFinalScore();
          await session.save();

          const report = interviewService.generateReport(session);
          
          socket.emit('interview-complete', {
            message: 'Interview ended early at your request.',
            summary: report.summary,
            report: report,
            speakText: `Interview complete. Your final score is ${report.summary.finalScore} percent.`
          });
          return;
        }

        // Calculate response time
        const responseTime = socket.questionStartTime 
          ? Math.round((Date.now() - socket.questionStartTime) / 1000) 
          : 0;

        // IMMEDIATELY acknowledge the answer (don't wait for evaluation)
        // This makes the interview feel responsive
        socket.emit('answer-result', {
          type: 'recorded',
          message: 'Answer recorded.',
          isSkipped: false,
          speakText: '' // Don't speak - move to next question quickly
        });

        // Clear current question immediately
        socket.currentQuestion = null;
        socket.questionStartTime = null;

        // Process answer in BACKGROUND (evaluation + storage)
        // This prevents blocking the next question
        const questionDataCopy = { ...questionData, responseTime };
        interviewService.processAnswer(session, answer, questionDataCopy)
          .then(async (result) => {
            // Update question stats in background
            if (questionData.questionId) {
              await questionService.updateQuestionStats(questionData.questionId, result.score);
            }
            
            // Reload session to get updated counts
            const updatedSession = await Session.findById(sessionId);
            if (updatedSession) {
              const answeredCount = updatedSession.answers.filter(a => !a.isSkipped).length;
              const skippedCount = updatedSession.answers.filter(a => a.isSkipped).length;
              const totalScore = updatedSession.answers.filter(a => !a.isSkipped).reduce((sum, a) => sum + a.score, 0);
              const avgScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;
              
              // Send progress update to client
              socket.emit('progress', {
                state: updatedSession.state,
                currentTopic: updatedSession.currentTopic,
                totalAnswered: answeredCount,
                totalSkipped: skippedCount,
                averageScore: avgScore,
                questionsAsked: updatedSession.answers.length
              });
            }
            
            console.log(`[Answer] ✅ Background processing complete. Score: ${result.score}`);
          })
          .catch((err) => {
            console.error('[Answer] ❌ Background processing failed:', err.message);
          });

      } catch (error) {
        console.error('Error submitting answer:', error);
        socket.emit('error', { message: 'Failed to process answer' });
      }
    });

    /**
     * Speech recognition result
     * For displaying live transcription
     */
    socket.on('speech-interim', (data) => {
      // Broadcast to other listeners (e.g., for admin monitoring)
      const sessionId = activeSessions.get(socket.id);
      if (sessionId) {
        socket.to(sessionId).emit('speech-interim', data);
      }
    });

    /**
     * Get interview progress
     */
    socket.on('get-progress', async () => {
      try {
        const sessionId = activeSessions.get(socket.id);
        if (!sessionId) {
          return socket.emit('error', { message: 'Not in a session' });
        }

        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        const answeredCount = session.answers.filter(a => !a.isSkipped).length;
        const skippedCount = session.answers.filter(a => a.isSkipped).length;
        const totalScore = session.answers.filter(a => !a.isSkipped).reduce((sum, a) => sum + a.score, 0);
        const avgScore = answeredCount > 0 ? Math.round(totalScore / answeredCount) : 0;

        socket.emit('progress', {
          state: session.state,
          currentTopic: session.currentTopic,
          questionsAsked: session.questionsAsked,
          totalAnswered: answeredCount,
          totalSkipped: skippedCount,
          averageScore: avgScore,
          topicsRemaining: session.skillsQueue.length,
          resumeQuestionsRemaining: session.resumeQuestions
            ? session.resumeQuestions.filter(q => !q.asked).length
            : 0
        });

      } catch (error) {
        console.error('Error getting progress:', error);
        socket.emit('error', { message: 'Failed to get progress' });
      }
    });

    /**
     * Request hint for current question
     */
    socket.on('request-hint', async () => {
      try {
        const questionData = socket.currentQuestion;
        
        if (!questionData) {
          return socket.emit('error', { message: 'No active question' });
        }

        // Generate a hint from keywords
        const keywords = questionData.keywords || [];
        let hint = '';

        if (keywords.length > 0) {
          hint = `Think about: ${keywords.slice(0, 3).join(', ')}`;
        } else {
          hint = 'Try to focus on the key concepts related to the question.';
        }

        socket.emit('hint', {
          hint,
          speakText: hint
        });

      } catch (error) {
        console.error('Error getting hint:', error);
        socket.emit('error', { message: 'Failed to get hint' });
      }
    });

    /**
     * End Interview (button click)
     * User wants to end the interview early and get the report
     */
    socket.on('end-interview', async () => {
      try {
        const sessionId = activeSessions.get(socket.id);
        if (!sessionId) {
          return socket.emit('error', { message: 'Not in a session' });
        }

        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        console.log(`🛑 User requested to end interview for session ${sessionId}`);

        // End the interview
        session.state = interviewService.STATES.FINISHED;
        session.endedAt = new Date();
        session.finalScore = session.calculateFinalScore();
        await session.save();

        // Generate report with all answers so far
        const report = interviewService.generateReport(session);
        
        socket.emit('interview-complete', {
          message: 'Interview ended at your request. Generating your report...',
          summary: report.summary,
          report: report,
          speakText: `Interview complete. Your final score is ${report.summary.finalScore} percent. Generating your detailed report.`
        });

      } catch (error) {
        console.error('Error ending interview:', error);
        socket.emit('error', { message: 'Failed to end interview' });
      }
    });

    /**
     * Disconnect handler
     */
    socket.on('disconnect', async () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);

      const sessionId = activeSessions.get(socket.id);
      if (sessionId) {
        try {
          const session = await Session.findById(sessionId);
          if (session && session.state !== 'FINISHED') {
            // Mark session as interrupted but don't end it
            // User can reconnect
            session.socketId = null;
            await session.save();
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
        activeSessions.delete(socket.id);
      }
    });

    /**
     * Error handler
     */
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });

  console.log('🔌 Socket.io handlers initialized');
};
