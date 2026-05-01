const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/messaggi
// Get messages for authenticated provider
router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, letto } = req.query;

  try {
    let sql = 'SELECT * FROM messaggi WHERE provider_id = $1';
    const params = [req.user.id];
    let paramCount = 2;

    if (letto !== undefined) {
      sql += ` AND letto = $${paramCount}`;
      params.push(letto === 'true');
      paramCount++;
    }

    sql += ' ORDER BY created_at DESC';

    const offset = (page - 1) * limit;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit);
    params.push(offset);

    const result = await db.query(sql, params);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM messaggi WHERE provider_id = $1',
      [req.user.id]
    );

    res.json({
      messaggi: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('List messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/messaggi/:id
// Get a specific message
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM messaggi WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch message error:', error);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/messaggi
// Create a new message (from visitor to provider)
router.post('/', optionalAuth, async (req, res) => {
  const { servizio_id, mittente_nome, mittente_email, mittente_telefono, provider_id, oggetto, messaggio } = req.body;

  if (!mittente_nome || !mittente_email || !provider_id || !oggetto || !messaggio) {
    return res.status(400).json({
      error: 'mittente_nome, mittente_email, provider_id, oggetto, and messaggio are required',
    });
  }

  try {
    const messaggioId = uuidv4();
    const result = await db.query(
      `INSERT INTO messaggi (id, servizio_id, mittente_nome, mittente_email, mittente_telefono, provider_id, oggetto, messaggio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [messaggioId, servizio_id || null, mittente_nome, mittente_email, mittente_telefono || null, provider_id, oggetto, messaggio]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// PATCH /api/messaggi/:id
// Mark message as read or add reply
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { letto, risposta } = req.body;

  try {
    // Verify ownership
    const message = await db.query('SELECT * FROM messaggi WHERE id = $1', [id]);

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.rows[0].provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = [];
    const values = [id];
    let paramCount = 2;

    if (letto !== undefined) {
      updates.push(`letto = $${paramCount}`);
      values.push(letto);
      paramCount++;
    }

    if (risposta !== undefined) {
      updates.push(`risposta = $${paramCount}`);
      values.push(risposta || null);
      paramCount++;

      if (risposta) {
        updates.push(`risposto_il = $${paramCount}`);
        values.push(new Date());
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.json(message.rows[0]);
    }

    const query = `
      UPDATE messaggi
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// DELETE /api/messaggi/:id
// Delete a message
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const message = await db.query('SELECT * FROM messaggi WHERE id = $1', [id]);

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.rows[0].provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query('DELETE FROM messaggi WHERE id = $1', [id]);

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET /api/messaggi/by-servizio/:servizioId
// Get all messages for a service
router.get('/by-servizio/:servizioId', requireAuth, async (req, res) => {
  const { servizioId } = req.params;

  try {
    // Verify ownership of service
    const service = await db.query('SELECT * FROM servizi WHERE id = $1', [servizioId]);

    if (service.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (service.rows[0].provider_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query(
      'SELECT * FROM messaggi WHERE servizio_id = $1 ORDER BY created_at DESC',
      [servizioId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Fetch service messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
