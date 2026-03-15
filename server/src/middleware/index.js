/**
 * Middleware Index
 * Export all middleware from a single point
 */

const errorHandler = require('./errorHandler');
const notFoundHandler = require('./notFoundHandler');
const upload = require('./upload');

module.exports = {
  errorHandler,
  notFoundHandler,
  upload
};
