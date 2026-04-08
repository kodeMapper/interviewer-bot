/**
 * Proctoring Routes
 * Proxies requests to the standalone Flask proctoring service.
 */

const express = require('express');
const router = express.Router();
const {
  getStatus,
  startProctoring,
  stopProctoring,
  videoFeed,
  setSessionMeta,
  getReport,
  downloadLog,
  downloadVideo,
  downloadPackage,
  processFrame
} = require('../adapters/proctoringAdapter');

router.get('/status', getStatus);
router.post('/start', startProctoring);
router.post('/stop', stopProctoring);
router.get('/video', videoFeed);
router.post('/session/meta', setSessionMeta);
router.get('/report', getReport);
router.post('/process_frame', processFrame);
router.get('/download/csv', downloadLog);
router.get('/download/video', downloadVideo);
router.get('/download/package', downloadPackage);

module.exports = router;
