const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// POST /api/auth/sync - Sync Clerk user to database
router.post('/sync', async (req, res) => {
  try {
    const { tipo_provider, nome_attivita, citta, regione, indirizzo, telefono, sito_web, instagram, descrizione_attivita } = req.body;

    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ errore: 'Non autenticato' });
    }

    const clerkUserId = req.auth.userId;

    if (!tipo_provider || !['location', 'animazione'].includes(tipo_provider)) {
      return res.status(400).json({ errore: 'tipo_provider non valido' });
    }

    if (!nome_attivita || nome_attivita.trim() === '') {
      return res.status(400).json({ errore: 'nome_attivita è obbligatorio' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM utenti WHERE clerk_id = $1',
      [clerkUserId]
    );

    let userId;

    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].id;
      await pool.query(
        `UPDATE utenti
         SET tipo_provider = $1, nome_attivita = $2, citta = $3, regione = $4,
             indirizzo = $5, telefono = $6, sito_web = $7, instagram = $8,
             descrizione_attivita = $9, aggiornato_il = NOW()
         WHERE id = $10`,
        [tipo_provider, nome_attivita, citta || null, regione || null,
         indirizzo || null, telefono || null, sito_web || null, instagram || null,
         descrizione_attivita || null, userId]
      );
    } else {
      const result = await pool.query(
        `INSERT INTO utenti
         (clerk_id, tipo_provider, nome_attivita, citta, regione, indirizzo, telefono, sito_web, instagram, descrizione_attivita, creato_il, aggiornato_il)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id`,
        [clerkUserId, tipo_provider, nome_attivita, citta || null, regione || null,
         indirizzo || null, telefono || null, sito_web || null, instagram || null,
         descrizione_attivita || null]
      );
      userId = result.rows[0].id;
    }

    res.json({
      successo: true,
      utente_id: userId,
      messaggio: 'Profilo sincronizzato'
    });
  } catch (error) {
    console.error('Errore in /sync:', error);
    res.status(500).json({ errore: 'Errore nel sincronizzare il profilo' });
  }
});

// GET /api/auth/profilo - Get current user's profile
router.get('/profilo', requireAuth, async (req, res) => {
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ errore: 'Non autenticato' });
    }

    const result = await pool.query(
      `SELECT id, clerk_id, tipo_provider, nome_attivita, descrizione_attivita,
              citta, regione, indirizzo, telefono, sito_web, instagram, avatar_url,
              creato_il, aggiornato_il
       FROM utenti
       WHERE clerk_id = $1`,
      [req.auth.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ errore: 'Utente non trovato' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Errore in GET /profilo:', error);
    res.status(500).json({ errore: 'Errore nel recuperare il profilo' });
  }
});

// PUT /api/auth/profilo - Update current user's profile
router.put('/profilo', requireAuth, async (req, res) => {
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ errore: 'Non autenticato' });
    }

    const { nome_attivita, descrizione_attivita, citta, regione, indirizzo, telefono, sito_web, instagram } = req.body;

    const userResult = await pool.query(
      'SELECT id FROM utenti WHERE clerk_id = $1',
      [req.auth.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ errore: 'Utente non trovato' });
    }

    const userId = userResult.rows[0].id;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (nome_attivita !== undefined) {
      updates.push(`nome_attivita = $${paramIndex++}`);
      values.push(nome_attivita);
    }
    if (descrizione_attivita !== undefined) {
      updates.push(`descrizione_attivita = $${paramIndex++}`);
      values.push(descrizione_attivita);
    }
    if (citta !== undefined) {
      updates.push(`citta = $${paramIndex++}`);
      values.push(citta);
    }
    if (regione !== undefined) {
      updates.push(`regione = $${paramIndex++}`);
      values.push(regione);
    }
    if (indirizzo !== undefined) {
      updates.push(`indirizzo = $${paramIndex++}`);
      values.push(indirizzo);
    }
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex++}`);
      values.push(telefono);
    }
    if (sito_web !== undefined) {
      updates.push(`sito_web = $${paramIndex++}`);
      values.push(sito_web);
    }
    if (instagram !== undefined) {
      updates.push(`instagram = $${paramIndex++}`);
      values.push(instagram);
    }

    if (updates.length === 0) {
      return res.status(400).json({ errore: 'Nessun campo da aggiornare' });
    }

    updates.push(`aggiornato_il = NOW()`);
    values.push(userId);

    const query = `UPDATE utenti SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Errore in PUT /profilo:', error);
    res.status(500).json({ errore: 'Errore nell\'aggiornare il profilo' });
  }
});

// GET /api/auth/check - Check authentication status
router.get('/check', optionalAuth, async (req, res) => {
  try {
    if (!req.auth || !req.auth.userId) {
      return res.json({ autenticato: false, utente: null });
    }

    const result = await pool.query(
      `SELECT id, clerk_id, tipo_provider, nome_attivita, avatar_url
       FROM utenti
       WHERE clerk_id = $1`,
      [req.auth.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ autenticato: true, utente: null });
    }

    res.json({ autenticato: true, utente: result.rows[0] });
  } catch (error) {
    console.error('Errore in GET /check:', error);
    res.status(500).json({ errore: 'Errore nel verificare l\'autenticazione' });
  }
});

module.exports = router;
