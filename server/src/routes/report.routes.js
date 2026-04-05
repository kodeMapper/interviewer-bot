const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Session } = require('../models');
const interviewService = require('../services/interview.service');

const PROCTOR_BASE = process.env.PROCTOR_URL || 'http://localhost:5000';

/**
 * GET /api/report/:sessionId/combined
 * Merges the AI Interviewer performance report with the Proctoring integrity report.
 */
router.get('/:sessionId/combined', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // 1. Generate Interview Report (MERN Native)
    const interviewReport = interviewService.generateReport(session);
    
    // 2. Fetch Proctoring Report (FastAPI Proxy)
    let proctoringReport = null;
    try {
       const proctorRes = await axios.get(`${PROCTOR_BASE}/report/latest`, { timeout: 4000 });
       if (proctorRes.data) {
           proctoringReport = proctorRes.data;
       }
    } catch (e) {
       console.log('Failed to fetch proctoring report for merged view:', e.message);
    }
    
    res.json({
        success: true,
        data: {
           interview: interviewReport,
           proctoring: proctoringReport
        }
    });

  } catch (err) {
    console.error('Error in merged report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
