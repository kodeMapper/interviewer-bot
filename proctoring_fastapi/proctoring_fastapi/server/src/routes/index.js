/**
 * Routes Index
 * Export all routes from a single point
 */

module.exports = {
  interviewRoutes: require('./interview.routes'),
  questionRoutes: require('./question.routes'),
  resumeRoutes: require('./resume.routes'),
  sessionRoutes: require('./session.routes')
};
