/**
 * Resume Routes
 * Endpoints for resume upload and processing
 */

const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resume.controller');
const { upload } = require('../middleware');

// Upload and process resume
router.post('/upload', upload.single('resume'), resumeController.uploadResume);

// Get parsed resume data
router.get('/:sessionId/data', resumeController.getResumeData);

// Get generated resume questions
router.get('/:sessionId/questions', resumeController.getResumeQuestions);

module.exports = router;
