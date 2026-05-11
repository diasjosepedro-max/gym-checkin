const router = require('express').Router();
const db     = require('../db');

// GET check-ins por data (ex: /api/checkins?date=2026-05-11)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const { rows } = await db.query(
      `SELECT ci.*, m.name AS member_name, c.name AS class_name
       FROM checkins ci
       JOIN members m ON ci.member_id = m.id
       JOIN classes c ON ci.class_id  = c.id
       WHERE ($1::date IS NULL OR ci.date = $1::date)
       ORDER BY ci.date DESC, c.time`,
      [date || null]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST fazer check-in
router.post('/', async (req, res) => {
  try {
    const { class_id, member_id, date } = req.body;
    const { rows } = await db.query(
      `INSERT INTO checkins (class_id, member_id, date)
       VALUES ($1,$2,$3)
       ON CONFLICT (class_id, member_id, date) DO NOTHING
       RETURNING *`,
      [class_id, member_id, date || new Date().toISOString().slice(0,10)]
    );
    res.json(rows[0] || { message: 'Check-in já existe' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE cancelar check-in
router.delete('/', async (req, res) => {
  try {
    const { class_id, member_id, date } = req.body;
    await db.query(
      'DELETE FROM checkins WHERE class_id=$1 AND member_id=$2 AND date=$3',
      [class_id, member_id, date]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;