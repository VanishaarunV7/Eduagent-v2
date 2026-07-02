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
  // ===========================================
  // MENTOR DEMO - BREAKPOINT 1
  // Place breakpoint here.
  //
  // Explain:
  // The Angular frontend has sent a login request containing the student's email and password.
  // The backend controller extracts these fields from the HTTP request body.
  //
  // Inspect:
  // req.body
  // email
  // password
  //
  // Expected value:
  // req.body: { email: "student@example.com", password: "password123" }
  // email: "student@example.com"
  // password: "password123"
  //
  // Press F10.
  // ===========================================
  try {
    console.log('req.body:', req.body);
    const { email, password } = req.body;
    console.log('Login attempt with email/userId:', email);
    // ── Validation ─────────────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 2
    // Place breakpoint here.
    //
    // Explain:
    // The backend queries the "users" collection in MongoDB to locate the user profile matching the provided email, student_id, or userId.
    //
    // Inspect:
    // email
    // user
    //
    // Expected value:
    // email: "student@example.com"
    // user: Mongoose Document containing fields like userId, role ("student"), name, and the hashed password.
    //
    // Press F10.
    // ===========================================
    let user = await User.findByEmailWithPassword(email);
    if (!user) {
      user = await User.findOne({ student_id: email }).select('+password');
    }
    if (!user) {
      user = await User.findOne({ userId: email }).select('+password');
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact an administrator.' });
    }

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 3
    // Place breakpoint here.
    //
    // Explain:
    // Verifying the password. Bcrypt compares the plain-text password from the request body against the secure hashed password retrieved from MongoDB.
    //
    // Inspect:
    // password
    // isMatch
    //
    // Expected value:
    // password: "password123"
    // isMatch: true
    //
    // Press F10.
    // ===========================================
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 4
    // Place breakpoint here.
    //
    // Explain:
    // The password is correct, so the backend generates a JWT token. It packages the student's identity details into a token payload and signs it using the secret key (JWT_SECRET).
    //
    // Inspect:
    // payload
    // token
    //
    // Expected value:
    // payload: { userId: "...", name: "...", email: "student@example.com", role: "student", student_id: "...", program_id: "..." }
    // token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." (a signed JWT string)
    //
    // Press F10.
    // ===========================================
    const payload = buildTokenPayload(user);
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    console.log(`[AuthController] Login successful: ${user.email} (${user.role})`);

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 5
    // Place breakpoint here.
    //
    // Explain:
    // The JWT token is returned back to the Angular frontend inside a JSON response. The client will store this token and use it for authenticated routes.
    //
    // Inspect:
    // token
    //
    // Expected value:
    // token: "eyJhbGciOi..."
    //
    // Press F10.
    // ===========================================
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
