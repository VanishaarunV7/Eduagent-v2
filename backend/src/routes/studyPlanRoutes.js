/**
 * Study Plan Routes
 * Exposes a secure file-streaming endpoint to download generated study plan PDFs.
 *
 * GET /api/study-plans/download/:fileId
 *   - Validates the fileId (UUID format)
 *   - Streams the PDF file from tmp/study-plans/
 *   - Sets Content-Disposition: attachment for browser download
 */

const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { OUTPUT_DIR } = require('../services/pdfGeneratorService');

// UUID v4 validation regex — prevents path traversal attacks
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/study-plans/download/:fileId
 * Download a generated study plan PDF by its file ID.
 */
router.get('/download/:fileId', (req, res) => {
  const { fileId } = req.params;

  // ── Security: validate UUID format to prevent directory traversal ─────────
  if (!UUID_REGEX.test(fileId)) {
    return res.status(400).json({ message: 'Invalid file ID format.' });
  }

  const fileName = `study-plan-${fileId}.pdf`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // ── Check file exists ──────────────────────────────────────────────────────
  if (!fs.existsSync(filePath)) {
    console.warn(`[Study Plan Route] File not found: ${filePath}`);
    return res.status(404).json({
      message: 'Study plan not found. It may have expired or was never generated. Please regenerate your study plan.'
    });
  }

  console.log(`[Study Plan Route] Streaming PDF: ${fileName}`);

  // ── Stream PDF to client ──────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="EduAgent-StudyPlan-${fileId}.pdf"`);
  res.setHeader('Cache-Control', 'no-cache');

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);

  readStream.on('error', (err) => {
    console.error('[Study Plan Route] File stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error streaming study plan file.' });
    }
  });
});

module.exports = router;
