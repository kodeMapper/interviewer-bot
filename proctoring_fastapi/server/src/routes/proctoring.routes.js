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
  videoFeed
} = require('../adapters/proctoringAdapter');

router.get('/status', getStatus);
router.post('/start', startProctoring);
router.post('/stop', stopProctoring);
router.get('/video', videoFeed);

module.exports = router;
