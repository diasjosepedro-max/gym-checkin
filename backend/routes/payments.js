const router = require('express').Router();
const db     = require('../db');

// GET pagamentos por mês (ex: /api/payments?month=2026-05)
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    const { rows } = await db.query(
      `SELECT p.*, m.name AS member_name
       FROM payments p
       JOIN members m ON p.member_id = m.id
       WHERE ($1 IS NULL OR p.month = $1)
       ORDER BY m.name`,
      [month || null]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST ou PUT marcar pagamento
router.post('/', async (req, res) => {
  try {
    const { member_id, month, paid } = req.body;
    const { rows } = await db.query(
      `INSERT INTO payments (member_id, month, paid, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (member_id, month)
       DO UPDATE SET paid=$3, updated_at=NOW()
       RETURNING *`,
      [member_id, month, paid]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;