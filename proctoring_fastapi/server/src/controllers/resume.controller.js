/**
 * Resume Controller
 * Handles resume upload and processing HTTP requests
 * 
 * FLOW (matching Python interview_controller.py):
 * 1. Upload resume → Extract text → Start Gemini in BACKGROUND (don't wait!)
 * 2. Return session immediately (resumeQuestionsReady = false)
 * 3. Background process generates questions via Gemini
 * 4. When done, update session.resumeQuestions and set resumeQuestionsReady = true
 * 5. Interview service checks this flag during WARMUP phase
 */

const path = require('path');
const fs = require('fs').promises;
const { Session } = require('../models');
const resumeService = require('../services/resume.service');
const interviewService = require('../services/interview.service');

// Store active background processes
const backgroundProcesses = new Map();

/**
 * Upload and process resume
 * IMPORTANT: This is NON-BLOCKING - Gemini runs in background
 */
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No resume file uploaded'
      });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const session = await Session.findById(sessionId);

    if (!session) {
      await fs.unlink(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    console.log(`[Resume] Starting resume processing for session ${sessionId}`);
    console.log(`[Resume] File: ${req.file.originalname}`);

    // Step 1: Extract text from resume (fast operation)
    const resumeText = await resumeService.extractText(req.file.path);
    console.log(`[Resume] Extracted ${resumeText.length} chars`);
    
    // Step 2: Detect skills from resume (for reference only, NOT for warmup)
    // Warmup uses userSelectedSkills (from main page), NOT resume-extracted skills
    const detectedSkills = resumeService.detectSkills(resumeText);
    console.log(`[Resume] Detected skills from resume: ${detectedSkills.join(', ')}`);
    console.log(`[Resume] User-selected skills for warmup: ${(session.userSelectedSkills || []).join(', ')}`);
    
    // Step 3: Update session with initial data (NO questions yet)
    // NOTE: skillsDetected stores resume-extracted skills (for reference only)
    // userSelectedSkills (already set from main page) is used for warmup questions
    session.resumePath = req.file.path;
    session.resumeSummary = resumeText.substring(0, 2000);
    session.skillsDetected = detectedSkills; // Only resume skills, NOT merged with user-selected
    session.resumeQuestionsReady = false; // NOT ready yet!
    session.resumeQuestions = []; // Empty for now
    await session.save();

    // Step 4: Start Gemini question generation in BACKGROUND
    // This is the key difference - we don't await this!
    console.log(`[Resume BG] Starting background question generation...`);
    
    processResumeInBackground(sessionId, resumeText, req.file.path)
      .then(() => {
        console.log(`[Resume BG] ✅ Background processing complete for session ${sessionId}`);
      })
      .catch((error) => {
        console.error(`[Resume BG] ❌ Background processing failed for session ${sessionId}:`, error.message);
      });

    // Step 5: Return IMMEDIATELY - don't wait for Gemini!
    res.json({
      success: true,
      data: {
        sessionId,
        fileName: req.file.originalname,
        skillsDetected: session.skillsDetected,
        resumeQuestionsReady: false, // Tell frontend questions are being generated
        message: 'Resume uploaded. Questions are being generated in background.',
        status: 'processing'
      }
    });
    
  } catch (error) {
    // Clean up file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }
    next(error);
  }
};

/**
 * Background process to generate questions via Gemini
 * Matches Python: _process_resume_background()
 * 
 * Uses direct PDF upload to Gemini for better accuracy
 */
async function processResumeInBackground(sessionId, resumeText, filePath) {
  try {
    console.log(`[Resume BG] Generating questions via Gemini...`);
    const startTime = Date.now();
    
    // Use direct PDF upload if file is PDF (better accuracy)
    // Falls back to text-based generation for other file types
    let resumeQuestions;
    if (filePath && filePath.toLowerCase().endsWith('.pdf')) {
      console.log(`[Resume BG] Using direct PDF upload to Gemini (best accuracy)...`);
      resumeQuestions = await resumeService.generateQuestionsFromFile(filePath);
    } else {
      resumeQuestions = await resumeService.generateQuestions(resumeText);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Resume BG] Generated ${resumeQuestions.length} questions in ${duration}s`);
    
    // Store resume summary if available
    const resumeSummary = resumeQuestions.resumeSummary || '';
    
    // Update session with generated questions
    const session = await Session.findById(sessionId);
    if (session) {
      // Note: Don't set _id manually - let MongoDB auto-generate ObjectIds
      session.resumeQuestions = resumeQuestions.map((q) => ({
        question: q.question,
        type: q.type || 'experience',
        difficulty: q.difficulty || 'medium',
        expectedAnswer: q.expectedAnswer || '',
        section: q.section || 'Resume',
        keywords: q.keywords || [],
        asked: false
      }));
      session.resumeQuestionsReady = true; // NOW it's ready!
      await session.save();
      
      console.log(`[Resume BG] ✅ Added ${resumeQuestions.length} questions to session`);
      console.log(`[Resume BG] 📁 Questions stored in session.resumeQuestions`);
      console.log(`[Resume BG] 🎯 resumeQuestionsReady = true`);
    }
    
  } catch (error) {
    console.error(`[Resume BG] ❌ Error generating questions:`, error.message);
    
    // Even on error, mark as "ready" with fallback questions
    const session = await Session.findById(sessionId);
    if (session) {
      // Use fallback questions
      let fallbackQuestions = [];
      if (resumeService.generateFallbackQuestions) {
        const rawFallback = await resumeService.generateFallbackQuestions(resumeText);
        // Format fallback questions properly for MongoDB schema
        fallbackQuestions = rawFallback.map((q) => ({
          question: q.question,
          type: q.type || 'experience',
          difficulty: q.difficulty || 'medium',
          expectedAnswer: q.expectedAnswer || '',
          section: q.section || 'Resume',
          keywords: q.keywords || [],
          asked: false
        }));
      }
      
      session.resumeQuestions = fallbackQuestions;
      session.resumeQuestionsReady = true;
      await session.save();
      
      console.log(`[Resume BG] ⚠️ Using fallback questions (${fallbackQuestions.length})`);
    }
  }
}

/**
 * Get parsed resume data
 */
exports.getResumeData = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (!session.resumePath) {
      return res.status(404).json({
        success: false,
        error: 'No resume uploaded for this session'
      });
    }

    res.json({
      success: true,
      data: {
        sessionId,
        resumeSummary: session.resumeSummary,
        skillsDetected: session.skillsDetected,
        hasQuestions: session.resumeQuestions.length > 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get generated resume questions
 */
exports.getResumeQuestions = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { includeAsked = 'false' } = req.query;

    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    let questions = session.resumeQuestions;

    // Filter out asked questions if requested
    if (includeAsked !== 'true') {
      questions = questions.filter(q => !q.asked);
    }

    res.json({
      success: true,
      data: {
        sessionId,
        questions: questions.map(q => ({
          id: q._id,
          question: q.question,
          type: q.type,
          difficulty: q.difficulty,
          section: q.section,
          asked: q.asked
        })),
        totalCount: session.resumeQuestions.length,
        remainingCount: session.resumeQuestions.filter(q => !q.asked).length
      }
    });
  } catch (error) {
    next(error);
  }
};
