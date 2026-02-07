/**
 * Session Controller
 * Handles session management HTTP requests
 */

const { Session } = require('../models');

/**
 * Get all sessions with pagination
 */
exports.getAllSessions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      state,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (state) {
      query.state = state;
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const sessions = await Session.find(query)
      .select('state skillsDetected questionsAsked finalScore startedAt endedAt createdAt')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Session.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(s => ({
          id: s._id,
          state: s.state,
          skills: s.skillsDetected,
          questionsAsked: s.questionsAsked,
          finalScore: s.finalScore,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          duration: s.durationMinutes
        })),
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session by ID with full details
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
        id: session._id,
        state: session.state,
        skills: session.skillsDetected,
        currentTopic: session.currentTopic,
        questionsAsked: session.questionsAsked,
        answers: session.answers.map(a => ({
          questionText: a.questionText,
          topic: a.topic,
          score: a.score,
          isCorrect: a.isCorrect,
          isSkipped: a.isSkipped,
          responseTime: a.responseTime
        })),
        resumeQuestions: session.resumeQuestions.length,
        resumeQuestionsAsked: session.resumeQuestionsAsked,
        finalScore: session.finalScore,
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
 * Delete session
 */
exports.deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findByIdAndDelete(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session statistics
 */
exports.getSessionStats = async (req, res, next) => {
  try {
    const stats = await Session.aggregate([
      {
        $facet: {
          totalStats: [
            {
              $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                completedSessions: {
                  $sum: { $cond: [{ $eq: ['$state', 'FINISHED'] }, 1, 0] }
                },
                avgScore: { $avg: '$finalScore' },
                avgQuestionsAsked: { $avg: '$questionsAsked' }
              }
            }
          ],
          stateDistribution: [
            {
              $group: {
                _id: '$state',
                count: { $sum: 1 }
              }
            }
          ],
          skillDistribution: [
            { $unwind: '$skillsDetected' },
            {
              $group: {
                _id: '$skillsDetected',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          recentSessions: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $project: {
                _id: 1,
                state: 1,
                finalScore: 1,
                createdAt: 1
              }
            }
          ]
        }
      }
    ]);

    const result = stats[0];
    const totalStats = result.totalStats[0] || {
      totalSessions: 0,
      completedSessions: 0,
      avgScore: 0,
      avgQuestionsAsked: 0
    };

    res.json({
      success: true,
      data: {
        summary: {
          totalSessions: totalStats.totalSessions,
          completedSessions: totalStats.completedSessions,
          completionRate: totalStats.totalSessions > 0 
            ? Math.round((totalStats.completedSessions / totalStats.totalSessions) * 100) 
            : 0,
          avgScore: Math.round(totalStats.avgScore || 0),
          avgQuestionsAsked: Math.round(totalStats.avgQuestionsAsked || 0)
        },
        stateDistribution: result.stateDistribution.map(s => ({
          state: s._id,
          count: s.count
        })),
        topSkills: result.skillDistribution.map(s => ({
          skill: s._id,
          count: s.count
        })),
        recentSessions: result.recentSessions
      }
    });
  } catch (error) {
    next(error);
  }
};
