const router = require('express').Router();
const db     = require('../db');

// GET todos os membros
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM members ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST criar membro
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const { rows } = await db.query(
      'INSERT INTO members (name) VALUES ($1) RETURNING *', [name]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE remover membro
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;