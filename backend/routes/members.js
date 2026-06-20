const router = require('express').Router();
const db     = require('../db');

// GET todos os membros (inclui type e has_pack de financial_clients para filtros)
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*,
        COALESCE(fc.type, 'PT') AS type,
        COALESCE(fc.has_pack, false) AS has_pack
      FROM members m
      LEFT JOIN financial_clients fc
        ON lower(trim(fc.name)) = lower(trim(m.name)) AND fc.active = true
      ORDER BY m.name
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST criar membro + cliente financeiro
router.post('/', async (req, res) => {
  try {
    const {
      name,
      // Campos financeiros opcionais
      type, sessions, has_pack, has_insurance,
      professor_id, standard_value, value_to_professor
    } = req.body;

    // Cria o membro
    const { rows } = await db.query(
      'INSERT INTO members (name) VALUES ($1) RETURNING *', [name]
    );
    const member = rows[0];

    // Cria sempre o cliente financeiro
    await db.query(`
      INSERT INTO financial_clients (name, type, sessions, has_pack, has_insurance, professor_id, standard_value, value_to_professor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT DO NOTHING`,
      [
        name,
        type || 'PT',
        sessions || '1x',
        has_pack || false,
        has_insurance || false,
        professor_id || null,
        standard_value || 0,
        value_to_professor || 0
      ]
    );

    res.json(member);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE remover membro
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM members WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;