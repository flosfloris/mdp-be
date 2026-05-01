const { requireSignIn } = require('@clerk/express');
const db = require('../config/database');

const clerkRequireAuth = requireSignIn();

async function requireAuth(req, res, next) {
  // First, verify Clerk authentication
  clerkRequireAuth(req, res, async (err) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: No valid session' });
    }

    try {
      const clerkId = req.auth?.userId;

      if (!clerkId) {
        return res.status(401).json({ error: 'Unauthorized: Invalid auth token' });
      }

      // Load user from database by clerk_id
      const result = await db.query('SELECT * FROM users WHERE clerk_id = $1', [clerkId]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      // Attach user to request
      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
}

async function optionalAuth(req, res, next) {
  try {
    const clerkId = req.auth?.userId;

    if (!clerkId) {
      // No auth, but that's okay
      req.user = null;
      return next();
    }

    // Load user from database by clerk_id
    const result = await db.query('SELECT * FROM users WHERE clerk_id = $1', [clerkId]);

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
};
