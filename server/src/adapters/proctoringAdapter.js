/**
 * Proctoring Adapter
 * Thin HTTP proxy to the standalone Flask proctoring service (port 5000).
 *
 * Why an adapter?
 *   The proctoring service uses OpenCV camera capture and a PyTorch CNN
 *   that must run in its own Python process.  Rather than embed it into
 *   the Express server, we forward requests so the React client only
 *   talks to one backend origin (port 5001).
 *
 * Flask endpoints consumed:
 *   GET  /status          → { looking_away, consecutive_away, alert_triggered, … }
 *   POST /start           → { status: "started" }
 *   POST /stop            → { status: "stopped" }
 *   GET  /video_feed      → multipart/x-mixed-replace MJPEG stream
 */

const axios = require('axios');

const PROCTOR_BASE = process.env.PROCTOR_URL || 'http://localhost:5000';

/**
 * GET /api/proctoring/status
 * Returns current gaze/attention state from the proctoring CNN.
 */
async function getStatus(req, res) {
  try {
    const { data } = await axios.get(`${PROCTOR_BASE}/status`, { timeout: 3000 });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Proctoring service is not running',
        hint: 'Start it with: cd proctoring && python server.py'
      });
    }
    res.status(502).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/proctoring/start
 * Tells the Flask service to begin camera capture + inference.
 */
async function startProctoring(req, res) {
  try {
    const { data } = await axios.post(`${PROCTOR_BASE}/start`, {}, { timeout: 5000 });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Proctoring service is not running'
      });
    }
    res.status(502).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/proctoring/stop
 * Tells the Flask service to stop camera capture.
 */
async function stopProctoring(req, res) {
  try {
    const { data } = await axios.post(`${PROCTOR_BASE}/stop`, {}, { timeout: 5000 });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Proctoring service is not running'
      });
    }
    res.status(502).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/proctoring/video
 * Pipes the MJPEG stream from Flask to the client.
 */
async function videoFeed(req, res) {
  try {
    const response = await axios.get(`${PROCTOR_BASE}/video_feed`, {
      responseType: 'stream',
      timeout: 10000
    });

    // Forward headers so the browser treats it as a live MJPEG stream
    res.setHeader('Content-Type', response.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache');

    response.data.pipe(res);

    // Clean up when client disconnects
    req.on('close', () => {
      response.data.destroy();
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'Proctoring service is not running'
      });
    }
    res.status(502).json({ success: false, error: err.message });
  }
}

module.exports = { getStatus, startProctoring, stopProctoring, videoFeed };
