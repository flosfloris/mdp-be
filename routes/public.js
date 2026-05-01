const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET /api/regioni - List all regions
router.get('/regioni', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT regione FROM utenti
       WHERE regione IS NOT NULL
       ORDER BY regione ASC`
    );

    const regioni = result.rows.map(row => row.regione);

    res.json({
      regioni: regioni
    });
  } catch (error) {
    console.error('Errore in GET /regioni:', error);
    res.status(500).json({ errore: 'Errore nel recuperare le regioni' });
  }
});

// GET /api/categorie/location - List location categories
router.get('/categorie/location', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT categoria FROM servizi
       WHERE tipo = 'location' AND categoria IS NOT NULL AND attivo = true
       ORDER BY categoria ASC`
    );

    const categorie = result.rows.map(row => row.categoria);

    res.json({
      categorie: categorie,
      tipo: 'location'
    });
  } catch (error) {
    console.error('Errore in GET /categorie/location:', error);
    res.status(500).json({ errore: 'Errore nel recuperare le categorie' });
  }
});

// GET /api/categorie/animazione - List animation categories
router.get('/categorie/animazione', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT categoria FROM servizi
       WHERE tipo = 'animazione' AND categoria IS NOT NULL AND attivo = true
       ORDER BY categoria ASC`
    );

    const categorie = result.rows.map(row => row.categoria);

    res.json({
      categorie: categorie,
      tipo: 'animazione'
    });
  } catch (error) {
    console.error('Errore in GET /categorie/animazione:', error);
    res.status(500).json({ errore: 'Errore nel recuperare le categorie' });
  }
});

module.exports = router;
