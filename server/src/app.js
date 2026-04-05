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
const { getOpenApiDocument, renderSwaggerUiHtml } = require('./docs/openapi');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');

const app = express();

// Documentation routes are served before helmet so the embedded Swagger assets load cleanly.
app.get('/api/docs/openapi.json', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getOpenApiDocument());
});

app.get('/api/docs', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(renderSwaggerUiHtml('/api/docs/openapi.json'));
});

// Cache-busting middleware for all API routes to prevent 304 issues
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

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
app.use('/api/report', require('./routes/report.routes'));

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
