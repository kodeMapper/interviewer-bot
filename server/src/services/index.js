/**
 * Services Index
 * Export all services from a single point
 */

module.exports = {
  interviewService: require('./interview.service'),
  answerService: require('./answer.service'),
  resumeService: require('./resume.service'),
  questionService: require('./question.service')
};
