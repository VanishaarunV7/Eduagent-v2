/**
 * authController.js — Login, Logout, and Me endpoints
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET   = process.env.JWT_SECRET   || 'eduagent_jwt_super_secret_key_2026_rbac';
const JWT_EXPIRES  = process.env.JWT_EXPIRES_IN || '7d';

// ─── Helper: build JWT payload ────────────────────────────────────────────────
function buildTokenPayload(user) {
  return {
    userId:     user.userId,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    student_id: user.student_id,
    teacher_id: user.teacher_id,
    admin_id:   user.admin_id,
    program_id: user.program_id
  };
}

// ─── Helper: safe user object (no password) ───────────────────────────────────
function safeUser(user) {
  return {
    userId:     user.userId,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    student_id: user.student_id,
    teacher_id: user.teacher_id,
    admin_id:   user.admin_id,
    program_id: user.program_id,
    isActive:   user.isActive,
    lastLogin:  user.lastLogin,
    createdAt:  user.createdAt
  };
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // ── Fetch user with password field ─────────────────────────────────────────
    const user = await User.findByEmailWithPassword(email);
    if (!user) {
      // Use generic message to prevent email enumeration
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact an administrator.' });
    }

    // ── Password check ─────────────────────────────────────────────────────────
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // ── Update lastLogin ───────────────────────────────────────────────────────
    user.lastLogin = new Date();
    await user.save();

    // ── Sign JWT ───────────────────────────────────────────────────────────────
    const payload = buildTokenPayload(user);
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    console.log(`[AuthController] Login successful: ${user.email} (${user.role})`);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: safeUser(user)
    });
  } catch (error) {
    console.error('[AuthController] Login error:', error);
    return res.status(500).json({ message: 'An internal server error occurred during login.' });
  }
};

/**
 * POST /api/auth/logout
 * Stateless logout — client discards token.
 * Requires authenticateJWT middleware.
 */
exports.logout = async (req, res) => {
  console.log(`[AuthController] Logout: ${req.user?.email}`);
  return res.status(200).json({ message: 'Logged out successfully.' });
};

/**
 * GET /api/auth/me
 * Returns current authenticated user data (decoded from token + DB lookup).
 * Requires authenticateJWT middleware.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ user: safeUser(user) });
  } catch (error) {
    console.error('[AuthController] getMe error:', error);
    return res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
};
