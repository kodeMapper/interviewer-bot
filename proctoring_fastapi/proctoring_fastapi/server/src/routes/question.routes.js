/**
 * Question Routes
 * Endpoints for question bank management
 */

const express = require('express');
const router = express.Router();
const questionController = require('../controllers/question.controller');

// Get questions by topic
router.get('/topic/:topic', questionController.getByTopic);

// Search questions by keyword
router.get('/search', questionController.search);

// Get question stats
router.get('/stats', questionController.getStats);

// Get all topics
router.get('/topics', questionController.getTopics);

module.exports = router;
