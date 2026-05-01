const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// GET /api/servizi - List services with filters
router.get(
  '/',
  query('tipo').optional().isIn(['location', 'animazione']),
  query('regione').optional().isString().trim(),
  query('citta').optional().isString().trim(),
  query('prezzo_min').optional().isFloat({ min: 0 }),
  query('prezzo_max').optional().isFloat({ min: 0 }),
  query('eta').optional().isString().trim(),
  query('indoor_outdoor').optional().isIn(['indoor', 'outdoor', 'entrambi']),
  query('categoria').optional().isString().trim(),
  query('search').optional().isString().trim(),
  query('sort').optional().isIn(['recenti', 'prezzo_asc', 'prezzo_desc']).default('recenti'),
  query('limit').optional().isInt({ min: 1, max: 100 }).default('20'),
  query('offset').optional().isInt({ min: 0 }).default('0'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errore: 'Parametri non validi', dettagli: errors.array() });
      }

      const { tipo, regione, citta, prezzo_min, prezzo_max, eta, indoor_outdoor, categoria, search, sort, limit, offset } = req.query;

      let query_str = `
        SELECT
          s.id, s.utente_id, s.tipo, s.nome, s.descrizione, s.prezzo, s.eta_minima, s.eta_massima,
          s.indoor_outdoor, s.categoria, s.attivo, s.creato_il, s.aggiornato_il,
          u.nome_attivita, u.avatar_url,
          (SELECT url FROM foto_servizi WHERE servizio_id = s.id ORDER BY creato_il ASC LIMIT 1) as prima_foto
        FROM servizi s
        JOIN utenti u ON s.utente_id = u.id
        WHERE s.attivo = true
      `;

      const values = [];
      let paramIndex = 1;

      if (tipo) {
        query_str += ` AND s.tipo = $${paramIndex++}`;
        values.push(tipo);
      }
      if (regione) {
        query_str += ` AND u.regione ILIKE $${paramIndex++}`;
        values.push(`%${regione}%`);
      }
      if (citta) {
        query_str += ` AND u.citta ILIKE $${paramIndex++}`;
        values.push(`%${citta}%`);
      }
      if (prezzo_min) {
        query_str += ` AND s.prezzo >= $${paramIndex++}`;
        values.push(parseFloat(prezzo_min));
      }
      if (prezzo_max) {
        query_str += ` AND s.prezzo <= $${paramIndex++}`;
        values.push(parseFloat(prezzo_max));
      }
      if (eta) {
        const eta_num = parseInt(eta);
        query_str += ` AND (s.eta_minima IS NULL OR s.eta_minima <= $${paramIndex}) AND (s.eta_massima IS NULL OR s.eta_massima >= $${paramIndex})`;
        values.push(eta_num);
        paramIndex++;
      }
      if (indoor_outdoor && indoor_outdoor !== 'entrambi') {
        query_str += ` AND s.indoor_outdoor = $${paramIndex++}`;
        values.push(indoor_outdoor);
      }
      if (categoria) {
        query_str += ` AND s.categoria ILIKE $${paramIndex++}`;
        values.push(`%${categoria}%`);
      }
      if (search) {
        query_str += ` AND (s.nome ILIKE $${paramIndex} OR s.descrizione ILIKE $${paramIndex} OR u.nome_attivita ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      if (sort === 'prezzo_asc') {
        query_str += ` ORDER BY s.prezzo ASC`;
      } else if (sort === 'prezzo_desc') {
        query_str += ` ORDER BY s.prezzo DESC`;
      } else {
        query_str += ` ORDER BY s.creato_il DESC`;
      }

      query_str += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      values.push(parseInt(limit));
      values.push(parseInt(offset));

      const result = await pool.query(query_str, values);

      let count_query = `
        SELECT COUNT(*) as total FROM servizi s
        JOIN utenti u ON s.utente_id = u.id
        WHERE s.attivo = true
      `;
      const count_values = [];
      let count_paramIndex = 1;

      if (tipo) {
        count_query += ` AND s.tipo = $${count_paramIndex++}`;
        count_values.push(tipo);
      }
      if (regione) {
        count_query += ` AND u.regione ILIKE $${count_paramIndex++}`;
        count_values.push(`%${regione}%`);
      }
      if (citta) {
        count_query += ` AND u.citta ILIKE $${count_paramIndex++}`;
        count_values.push(`%${citta}%`);
      }
      if (prezzo_min) {
        count_query += ` AND s.prezzo >= $${count_paramIndex++}`;
        count_values.push(parseFloat(prezzo_min));
      }
      if (prezzo_max) {
        count_query += ` AND s.prezzo <= $${count_paramIndex++}`;
        count_values.push(parseFloat(prezzo_max));
      }
      if (eta) {
        const eta_num = parseInt(eta);
        count_query += ` AND (s.eta_minima IS NULL OR s.eta_minima <= $${count_paramIndex}) AND (s.eta_massima IS NULL OR s.eta_massima >= $${count_paramIndex})`;
        count_values.push(eta_num);
        count_paramIndex++;
      }
      if (indoor_outdoor && indoor_outdoor !== 'entrambi') {
        count_query += ` AND s.indoor_outdoor = $${count_paramIndex++}`;
        count_values.push(indoor_outdoor);
      }
      if (categoria) {
        count_query += ` AND s.categoria ILIKE $${count_paramIndex++}`;
        count_values.push(`%${categoria}%`);
      }
      if (search) {
        count_query += ` AND (s.nome ILIKE $${count_paramIndex} OR s.descrizione ILIKE $${count_paramIndex} OR u.nome_attivita ILIKE $${count_paramIndex})`;
        count_values.push(`%${search}%`);
      }

      const countResult = await pool.query(count_query, count_values);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        servizi: result.rows,
        paginazione: {
          totale: total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pagina: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
          pagine_totali: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Errore in GET /servizi:', error);
      res.status(500).json({ errore: 'Errore nel recuperare i servizi' });
    }
  }
);

// GET /api/servizi/:id - Get service detail
router.get(
  '/:id',
  param('id').isInt(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errore: 'ID non valido' });
      }

      const { id } = req.params;

      const result = await pool.query(
        `SELECT
          s.id, s.utente_id, s.tipo, s.nome, s.descrizione, s.prezzo, s.eta_minima, s.eta_massima,
          s.indoor_outdoor, s.categoria, s.attivo, s.creato_il, s.aggiornato_il,
          u.id as utente_id, u.nome_attivita, u.avatar_url, u.descrizione_attivita,
          u.citta, u.regione, u.telefono, u.sito_web, u.instagram
         FROM servizi s
         JOIN utenti u ON s.utente_id = u.id
         WHERE s.id = $1 AND s.attivo = true`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ errore: 'Servizio non trovato' });
      }

      const servizio = result.rows[0];

      const fotoResult = await pool.query(
        'SELECT id, url, creato_il FROM foto_servizi WHERE servizio_id = $1 ORDER BY creato_il ASC',
        [id]
      );

      servizio.foto = fotoResult.rows;

      res.json(servizio);
    } catch (error) {
      console.error('Errore in GET /servizi/:id:', error);
      res.status(500).json({ errore: 'Errore nel recuperare il servizio' });
    }
  }
);

// POST /api/servizi - Create new service
router.post(
  '/',
  requireAuth,
  async (req, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ errore: 'Non autenticato' });
      }

      const { tipo, nome, descrizione, prezzo, eta_minima, eta_massima, indoor_outdoor, categoria } = req.body;

      if (!tipo || !['location', 'animazione'].includes(tipo)) {
        return res.status(400).json({ errore: 'tipo non valido' });
      }
      if (!nome || nome.trim() === '') {
        return res.status(400).json({ errore: 'nome è obbligatorio' });
      }
      if (prezzo === undefined || prezzo === null || isNaN(prezzo)) {
        return res.status(400).json({ errore: 'prezzo è obbligatorio' });
      }

      const userResult = await pool.query(
        'SELECT id, tipo_provider FROM utenti WHERE clerk_id = $1',
        [req.auth.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ errore: 'Utente non trovato' });
      }

      const user = userResult.rows[0];

      if (user.tipo_provider !== tipo) {
        return res.status(400).json({ errore: `Il tuo profilo è di tipo ${user.tipo_provider}, non puoi creare servizi di tipo ${tipo}` });
      }

      const result = await pool.query(
        `INSERT INTO servizi
         (utente_id, tipo, nome, descrizione, prezzo, eta_minima, eta_massima, indoor_outdoor, categoria, attivo, creato_il, aggiornato_il)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
         RETURNING *`,
        [user.id, tipo, nome, descrizione || null, parseFloat(prezzo),
         eta_minima ? parseInt(eta_minima) : null,
         eta_massima ? parseInt(eta_massima) : null,
         indoor_outdoor || null, categoria || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Errore in POST /servizi:', error);
      res.status(500).json({ errore: 'Errore nella creazione del servizio' });
    }
  }
);

// PUT /api/servizi/:id - Update own service
router.put(
  '/:id',
  requireAuth,
  param('id').isInt(),
  async (req, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ errore: 'Non autenticato' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errore: 'ID non valido' });
      }

      const { id } = req.params;
      const { nome, descrizione, prezzo, eta_minima, eta_massima, indoor_outdoor, categoria } = req.body;

      const userResult = await pool.query(
        'SELECT id FROM utenti WHERE clerk_id = $1',
        [req.auth.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ errore: 'Utente non trovato' });
      }

      const userId = userResult.rows[0].id;

      const servizioResult = await pool.query(
        'SELECT id FROM servizi WHERE id = $1 AND utente_id = $2',
        [id, userId]
      );

      if (servizioResult.rows.length === 0) {
        return res.status(403).json({ errore: 'Non puoi modificare questo servizio' });
      }

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (nome !== undefined) {
        updates.push(`nome = $${paramIndex++}`);
        values.push(nome);
      }
      if (descrizione !== undefined) {
        updates.push(`descrizione = $${paramIndex++}`);
        values.push(descrizione);
      }
      if (prezzo !== undefined) {
        updates.push(`prezzo = $${paramIndex++}`);
        values.push(parseFloat(prezzo));
      }
      if (eta_minima !== undefined) {
        updates.push(`eta_minima = $${paramIndex++}`);
        values.push(eta_minima ? parseInt(eta_minima) : null);
      }
      if (eta_massima !== undefined) {
        updates.push(`eta_massima = $${paramIndex++}`);
        values.push(eta_massima ? parseInt(eta_massima) : null);
      }
      if (indoor_outdoor !== undefined) {
        updates.push(`indoor_outdoor = $${paramIndex++}`);
        values.push(indoor_outdoor);
      }
      if (categoria !== undefined) {
        updates.push(`categoria = $${paramIndex++}`);
        values.push(categoria);
      }

      if (updates.length === 0) {
        return res.status(400).json({ errore: 'Nessun campo da aggiornare' });
      }

      updates.push(`aggiornato_il = NOW()`);
      values.push(id);

      const query = `UPDATE servizi SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await pool.query(query, values);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Errore in PUT /servizi/:id:', error);
      res.status(500).json({ errore: 'Errore nell\'aggiornare il servizio' });
    }
  }
);

// DELETE /api/servizi/:id - Soft-delete own service
router.delete(
  '/:id',
  requireAuth,
  param('id').isInt(),
  async (req, res) => {
    try {
      if (!req.auth || !req.auth.userId) {
        return res.status(401).json({ errore: 'Non autenticato' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errore: 'ID non valido' });
      }

      const { id } = req.params;

      const userResult = await pool.query(
        'SELECT id FROM utenti WHERE clerk_id = $1',
        [req.auth.userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ errore: 'Utente non trovato' });
      }

      const userId = userResult.rows[0].id;

      const servizioResult = await pool.query(
        'SELECT id FROM servizi WHERE id = $1 AND utente_id = $2',
        [id, userId]
      );

      if (servizioResult.rows.length === 0) {
        return res.status(403).json({ errore: 'Non puoi eliminare questo servizio' });
      }

      await pool.query(
        'UPDATE servizi SET attivo = false, aggiornato_il = NOW() WHERE id = $1',
        [id]
      );

      res.json({ messaggio: 'Servizio eliminato' });
    } catch (error) {
      console.error('Errore in DELETE /servizi/:id:', error);
      res.status(500).json({ errore: 'Errore nell\'eliminare il servizio' });
    }
  }
);

// GET /api/servizi/provider/miei - List own services
router.get('/provider/miei', requireAuth, async (req, res) => {
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ errore: 'Non autenticato' });
    }

    const userResult = await pool.query(
      'SELECT id FROM utenti WHERE clerk_id = $1',
      [req.auth.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ errore: 'Utente non trovato' });
    }

    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT
        s.id, s.utente_id, s.tipo, s.nome, s.descrizione, s.prezzo, s.eta_minima, s.eta_massima,
        s.indoor_outdoor, s.categoria, s.attivo, s.creato_il, s.aggiornato_il,
        (SELECT url FROM foto_servizi WHERE servizio_id = s.id ORDER BY creato_il ASC LIMIT 1) as prima_foto
       FROM servizi s
       WHERE s.utente_id = $1
       ORDER BY s.creato_il DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Errore in GET /servizi/provider/miei:', error);
    res.status(500).json({ errore: 'Errore nel recuperare i tuoi servizi' });
  }
});

// GET /api/servizi/provider/:id - Public provider profile
router.get(
  '/provider/:id',
  param('id').isInt(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errore: 'ID non valido' });
      }

      const { id } = req.params;

      const userResult = await pool.query(
        `SELECT id, nome_attivita, descrizione_attivita, avatar_url, citta, regione,
                telefono, sito_web, instagram, tipo_provider
         FROM utenti WHERE id = $1`,
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ errore: 'Provider non trovato' });
      }

      const provider = userResult.rows[0];

      const servizziResult = await pool.query(
        `SELECT
          s.id, s.tipo, s.nome, s.descrizione, s.prezzo, s.eta_minima, s.eta_massima,
          s.indoor_outdoor, s.categoria, s.creato_il, s.aggiornato_il,
          (SELECT url FROM foto_servizi WHERE servizio_id = s.id ORDER BY creato_il ASC LIMIT 1) as prima_foto
         FROM servizi s
         WHERE s.utente_id = $1 AND s.attivo = true
         ORDER BY s.creato_il DESC`,
        [id]
      );

      res.json({
        provider,
        servizi: servizziResult.rows
      });
    } catch (error) {
      console.error('Errore in GET /servizi/provider/:id:', error);
      res.status(500).json({ errore: 'Errore nel recuperare il profilo del provider' });
    }
  }
);

module.exports = router;
