const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

db.query(`
  CREATE TABLE IF NOT EXISTS client_trainings (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id  UUID NOT NULL REFERENCES financial_clients(id),
    month      VARCHAR(3) NOT NULL,
    year       INT NOT NULL DEFAULT 2026,
    count      INT NOT NULL DEFAULT 0,
    UNIQUE(client_id, month, year)
  )
`).catch(() => {});

// GET contagem de treinos por mês
router.get('/', auth, async (req, res) => {
  try {
    const { month, year = 2026 } = req.query;
    const { rows } = await db.query(`
      SELECT ct.client_id, ct.count
      FROM client_trainings ct
      JOIN financial_clients fc ON ct.client_id = fc.id
      WHERE ct.month = $1 AND ct.year = $2 AND fc.active = true
    `, [month, year]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST upsert contagem de treinos para um cliente
router.post('/:client_id', auth, async (req, res) => {
  try {
    const { month, year = 2026, count } = req.body;
    const { rows } = await db.query(`
      INSERT INTO client_trainings (client_id, month, year, count)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (client_id, month, year) DO UPDATE SET count = $4
      RETURNING *
    `, [req.params.client_id, month, year, Math.max(0, count)]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
