/**
 * Not Found Handler Middleware
 * Handles 404 errors for undefined routes
 */

const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    hint: 'Check the API documentation for available endpoints'
  });
};

module.exports = notFoundHandler;
