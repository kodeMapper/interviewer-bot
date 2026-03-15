/**
 * Session Routes
 * Endpoints for session management and history
 */

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');

// Get all sessions (with pagination)
router.get('/', sessionController.getAllSessions);

// Get session by ID
router.get('/:sessionId', sessionController.getSession);

// Delete session
router.delete('/:sessionId', sessionController.deleteSession);

// Get session statistics
router.get('/stats/summary', sessionController.getSessionStats);

module.exports = router;
