/**
 * Interview Routes
 * Endpoints for managing interview sessions
 */

const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interview.controller');

// Start a new interview session
router.post('/start', interviewController.startSession);

// Get session status
router.get('/session/:sessionId', interviewController.getSession);

// End interview session
router.post('/session/:sessionId/end', interviewController.endSession);

// Get interview report
router.get('/session/:sessionId/report', interviewController.getReport);

module.exports = router;
