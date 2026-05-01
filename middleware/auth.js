const { getAuth } = require('@clerk/express');
const db = require('../config/database');

async function requireAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ error: 'Autenticazione richiesta' });
    }

    const result = await db.query('SELECT * FROM users WHERE clerk_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Utente non registrato' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Token non valido' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      req.user = null;
      return next();
    }

    const result = await db.query('SELECT * FROM users WHERE clerk_id = $1', [userId]);
    req.user = result.rows.length > 0 ? result.rows[0] : null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
