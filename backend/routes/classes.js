const router = require('express').Router();
const db     = require('../db');

// GET todas as aulas com membros
router.get('/', async (req, res) => {
  try {
    const { rows: classes } = await db.query(`
      SELECT c.*, t.name AS teacher_name
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      ORDER BY c.day, c.time
    `);

    // Busca membros permitidos para cada aula
    for (const cls of classes) {
      const { rows } = await db.query(
        `SELECT m.id, m.name FROM class_members cm
         JOIN members m ON cm.member_id = m.id
         WHERE cm.class_id = $1`, [cls.id]
      );
      cls.allowed_members = rows;
    }

    res.json(classes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST criar aula
router.post('/', async (req, res) => {
  try {
    const { name, day, time, duration, teacher_id, color, allowed_members } = req.body;
    const { rows } = await db.query(
      `INSERT INTO classes (name, day, time, duration, teacher_id, color)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, day, time, duration || 60, teacher_id || null, color || '#85a800']
    );
    const cls = rows[0];

    // Adiciona membros permitidos
    if (allowed_members?.length) {
      for (const mid of allowed_members) {
        await db.query(
          'INSERT INTO class_members (class_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [cls.id, mid]
        );
      }
    }
    res.json(cls);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT atualizar aula
router.put('/:id', async (req, res) => {
  try {
    const { name, day, time, duration, teacher_id, color, allowed_members } = req.body;
    const { rows } = await db.query(
      `UPDATE classes SET name=$1, day=$2, time=$3, duration=$4,
       teacher_id=$5, color=$6 WHERE id=$7 RETURNING *`,
      [name, day, time, duration, teacher_id || null, color, req.params.id]
    );

    // Atualiza membros
    await db.query('DELETE FROM class_members WHERE class_id=$1', [req.params.id]);
    if (allowed_members?.length) {
      for (const mid of allowed_members) {
        await db.query(
          'INSERT INTO class_members (class_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, mid]
        );
      }
    }
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE remover aula
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM classes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;