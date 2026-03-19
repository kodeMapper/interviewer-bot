/**
 * Question Controller
 * Handles question bank HTTP requests
 */

const { Question } = require('../models');

/**
 * Get questions by topic
 */
exports.getByTopic = async (req, res, next) => {
  try {
    const { topic } = req.params;
    const { limit = 10, page = 1 } = req.query;

    const validTopics = ['Java', 'Python', 'JavaScript', 'React', 'SQL', 'Machine_Learning', 'Deep_Learning'];
    
    if (!validTopics.includes(topic)) {
      return res.status(400).json({
        success: false,
        error: `Invalid topic. Valid topics are: ${validTopics.join(', ')}`
      });
    }

    const questions = await Question.find({ topic, isActive: true })
      .select('question expectedAnswer keywords difficulty')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Question.countDocuments({ topic, isActive: true });

    res.json({
      success: true,
      data: {
        questions,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search questions by keyword
 */
exports.search = async (req, res, next) => {
  try {
    const { q, topics } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const allowedTopics = topics ? topics.split(',') : [];
    const questions = await Question.searchByKeyword(q, allowedTopics);

    res.json({
      success: true,
      data: {
        query: q,
        results: questions,
        count: questions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get question statistics
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$topic',
          count: { $sum: 1 },
          avgTimesAsked: { $avg: '$timesAsked' },
          avgScore: { $avg: '$avgScore' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalQuestions = stats.reduce((sum, s) => sum + s.count, 0);

    res.json({
      success: true,
      data: {
        totalQuestions,
        topicStats: stats.map(s => ({
          topic: s._id,
          count: s.count,
          avgTimesAsked: Math.round(s.avgTimesAsked || 0),
          avgScore: Math.round(s.avgScore || 0)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available topics
 */
exports.getTopics = async (req, res, next) => {
  try {
    const topics = await Question.distinct('topic', { isActive: true });

    res.json({
      success: true,
      data: {
        topics,
        count: topics.length
      }
    });
  } catch (error) {
    next(error);
  }
};
