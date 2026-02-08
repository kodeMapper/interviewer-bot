/**
 * Express Application Setup
 * Main app configuration with middleware and routes
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { config } = require('./config/environment');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.clientUrl,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Request logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (for uploaded resumes temporarily)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/interview', require('./routes/interview.routes'));
app.use('/api/questions', require('./routes/question.routes'));
app.use('/api/resume', require('./routes/resume.routes'));
app.use('/api/session', require('./routes/session.routes'));
app.use('/api/proctoring', require('./routes/proctoring.routes'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
