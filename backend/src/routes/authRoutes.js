/**
 * authRoutes.js — Authentication API Routes
 *
 * POST /api/auth/login    — public (no JWT required)
 * POST /api/auth/logout   — protected
 * GET  /api/auth/me       — protected
 */

const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');

// Public
router.post('/login',  authController.login);

// Protected
router.post('/logout', authenticateJWT, authController.logout);
router.get('/me',      authenticateJWT, authController.getMe);

module.exports = router;
