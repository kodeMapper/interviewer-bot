/**
 * Interview Controller
 * Handles interview session HTTP requests
 */

const { Session } = require('../models');
const interviewService = require('../services/interview.service');

/**
 * Start a new interview session
 */
exports.startSession = async (req, res, next) => {
  try {
    const { skills, resumePath } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Skills array is required'
      });
    }

    // Pass user-selected skills from main page
    // These will be used for warmup questions from MongoDB
    const session = await interviewService.createSession({
      userSelectedSkills: skills, // User-selected skills for warmup
      resumePath,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        state: session.state,
        skills: session.userSelectedSkills, // Return user-selected skills
        message: 'Interview session created. Connect via WebSocket to begin.'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session details
 */
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        state: session.state,
        questionsAsked: session.questionsAsked,
        currentTopic: session.currentTopic,
        skillsDetected: session.skillsDetected,
        skillsQueue: session.skillsQueue,
        answersCount: session.answers.length,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        duration: session.durationMinutes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End interview session
 */
exports.endSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Calculate final score and end session
    session.state = 'FINISHED';
    session.endedAt = new Date();
    session.finalScore = session.calculateFinalScore();
    await session.save();

    res.json({
      success: true,
      data: {
        sessionId: session._id,
        state: session.state,
        finalScore: session.finalScore,
        duration: session.durationMinutes,
        questionsAnswered: session.answers.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get interview report
 */
exports.getReport = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Generate detailed report
    const report = interviewService.generateReport(session);

    // Disable caching to ensure fresh report data
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};
