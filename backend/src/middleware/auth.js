/**
 * auth.js — JWT Authentication Middleware
 *
 * Exports:
 *   authenticateJWT  — verifies Bearer token, attaches req.user
 *   authorizeRoles   — role-based access control check
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'eduagent_jwt_super_secret_key_2026_rbac';

/**
 * authenticateJWT
 * Verifies the JWT from the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
const authenticateJWT = (req, res, next) => {
  // ===========================================
  // MENTOR DEMO - BREAKPOINT 6
  // Place breakpoint here.
  //
  // Explain:
  // The request is intercepted by the JWT middleware. We check for the presence of the Authorization header containing the Bearer token.
  //
  // Inspect:
  // authHeader
  //
  // Expected value:
  // authHeader: "Bearer eyJhbGciOi..."
  //
  // Press F10.
  // ===========================================
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Access denied. No authentication token provided.',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // ===========================================
    // MENTOR DEMO - BREAKPOINT 7
    // Place breakpoint here.
    //
    // Explain:
    // We verify the token signature using the backend's secret key. If valid, the decoded payload is attached to req.user so downstream handlers can identify the authenticated student.
    //
    // Inspect:
    // decoded
    // req.user
    //
    // Expected value:
    // decoded: { userId: "...", name: "...", role: "student", student_id: "...", program_id: "..." }
    // req.user: { userId: "...", name: "...", role: "student", student_id: "...", program_id: "..." }
    //
    // Press F10.
    // ===========================================
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      message: 'Invalid authentication token.',
      code: 'INVALID_TOKEN'
    });
  }
};

/**
 * authorizeRoles(...roles)
 * Factory function — returns middleware that checks if req.user.role
 * is included in the allowed roles array.
 *
 * Usage: router.get('/admin-only', authenticateJWT, authorizeRoles('admin'), handler)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated.', code: 'NOT_AUTHENTICATED' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}.`,
        code: 'FORBIDDEN',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

module.exports = { authenticateJWT, authorizeRoles };
