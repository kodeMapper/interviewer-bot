/**
 * Question Service
 * Question retrieval and counter-questioning logic
 * Migrated from Python question_bank.py
 */

const { Question } = require('../models');

/**
 * Get a random question by topic, excluding already asked questions
 */
async function getRandomQuestion(topic, excludeIds = []) {
  return Question.getRandomByTopic(topic, excludeIds);
}

/**
 * Search questions by keyword
 */
async function searchByKeyword(keyword, allowedTopics = []) {
  return Question.searchByKeyword(keyword, allowedTopics);
}

/**
 * Get counter-question based on context keywords from user's answer
 */
async function getCounterQuestion(contextKeywords, currentTopic, excludeIds = []) {
  // Try to find a question that matches the context
  for (const keyword of contextKeywords) {
    const questions = await Question.find({
      topic: currentTopic,
      isActive: true,
      _id: { $nin: excludeIds },
      $or: [
        { keywords: { $regex: keyword, $options: 'i' } },
        { question: { $regex: keyword, $options: 'i' } }
      ]
    }).limit(5);

    if (questions.length > 0) {
      return questions[Math.floor(Math.random() * questions.length)];
    }
  }

  // Fallback to random question
  return getRandomQuestion(currentTopic, excludeIds);
}

/**
 * Get questions by difficulty level
 */
async function getByDifficulty(topic, difficulty, limit = 5) {
  return Question.find({
    topic,
    difficulty,
    isActive: true
  }).limit(limit);
}

/**
 * Get questions for multiple topics (mix round)
 */
async function getMixedQuestions(topics, count = 5, excludeIds = []) {
  const questions = [];
  const questionsPerTopic = Math.ceil(count / topics.length);

  for (const topic of topics) {
    const topicQuestions = await Question.find({
      topic,
      isActive: true,
      _id: { $nin: excludeIds }
    })
      .limit(questionsPerTopic);
    
    questions.push(...topicQuestions);
  }

  // Shuffle and return requested count
  return shuffleArray(questions).slice(0, count);
}

/**
 * Update question statistics after being asked
 */
async function updateQuestionStats(questionId, score) {
  const question = await Question.findById(questionId);
  if (!question) return;

  const newTimesAsked = question.timesAsked + 1;
  const newAvgScore = (question.avgScore * question.timesAsked + score) / newTimesAsked;

  question.timesAsked = newTimesAsked;
  question.avgScore = Math.round(newAvgScore);
  await question.save();
}

/**
 * Get topic statistics
 */
async function getTopicStats() {
  const stats = await Question.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$topic',
        count: { $sum: 1 },
        avgTimesAsked: { $avg: '$timesAsked' },
        avgScore: { $avg: '$avgScore' }
      }
    }
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = {
      count: stat.count,
      avgTimesAsked: Math.round(stat.avgTimesAsked || 0),
      avgScore: Math.round(stat.avgScore || 0)
    };
    return acc;
  }, {});
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  getRandomQuestion,
  searchByKeyword,
  getCounterQuestion,
  getByDifficulty,
  getMixedQuestions,
  updateQuestionStats,
  getTopicStats
};
