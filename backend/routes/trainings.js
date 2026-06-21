const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

db.query(`
  CREATE TABLE IF NOT EXISTS client_compensations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id  UUID NOT NULL REFERENCES financial_clients(id) UNIQUE,
    count      INT NOT NULL DEFAULT 0
  )
`).catch(() => {});

// GET contagem de compensações (todos os clientes ativos)
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cc.client_id, cc.count
      FROM client_compensations cc
      JOIN financial_clients fc ON cc.client_id = fc.id
      WHERE fc.active = true AND cc.count > 0
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST upsert contagem de compensações para um cliente
router.post('/:client_id', auth, async (req, res) => {
  try {
    const { count } = req.body;
    const val = Math.max(0, Number(count) || 0);
    const { rows } = await db.query(`
      INSERT INTO client_compensations (client_id, count)
      VALUES ($1, $2)
      ON CONFLICT (client_id) DO UPDATE SET count = $2
      RETURNING *
    `, [req.params.client_id, val]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
