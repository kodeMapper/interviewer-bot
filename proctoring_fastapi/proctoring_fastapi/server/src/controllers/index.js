/**
 * Controllers Index
 * Export all controllers from a single point
 */

module.exports = {
  interviewController: require('./interview.controller'),
  questionController: require('./question.controller'),
  resumeController: require('./resume.controller'),
  sessionController: require('./session.controller')
};
