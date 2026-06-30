const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

db.query(`
  CREATE TABLE IF NOT EXISTS class_week_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    week_date DATE NOT NULL,
    name VARCHAR(200),
    time VARCHAR(5),
    duration INTEGER,
    color VARCHAR(20),
    teacher_id UUID,
    UNIQUE(class_id, week_date)
  )
`).catch(() => {});

// GET overrides para uma semana
router.get('/overrides', async (req, res) => {
  try {
    const { week } = req.query;
    if (!week) return res.json([]);
    const { rows } = await db.query(`
      SELECT cwo.*, t.name AS teacher_name
      FROM class_week_overrides cwo
      LEFT JOIN teachers t ON cwo.teacher_id = t.id
      WHERE cwo.week_date = $1`, [week]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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

// POST definir membros de aula a partir de clientes financeiros (find-or-create member)
router.post('/:id/set-financial-members', async (req, res) => {
  try {
    const { financial_client_ids } = req.body;
    await db.query('DELETE FROM class_members WHERE class_id=$1', [req.params.id]);
    for (const fcId of (financial_client_ids || [])) {
      const { rows: fc } = await db.query('SELECT name FROM financial_clients WHERE id=$1 AND active=true', [fcId]);
      if (!fc.length) continue;
      const name = fc[0].name;
      let { rows: existing } = await db.query("SELECT id FROM members WHERE lower(trim(name))=lower(trim($1))", [name]);
      let memberId;
      if (existing.length) {
        memberId = existing[0].id;
      } else {
        const { rows: nm } = await db.query('INSERT INTO members (name) VALUES ($1) RETURNING id', [name]);
        memberId = nm[0].id;
      }
      await db.query('INSERT INTO class_members (class_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, memberId]);
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST override semanal de aula
router.post('/:id/override', async (req, res) => {
  try {
    const { week_date, name, time, duration, color, teacher_id } = req.body;
    const { rows } = await db.query(`
      INSERT INTO class_week_overrides (class_id, week_date, name, time, duration, color, teacher_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (class_id, week_date) DO UPDATE SET
        name=$3, time=$4, duration=$5, color=$6, teacher_id=$7
      RETURNING *`,
      [req.params.id, week_date, name, time, duration, color, teacher_id || null]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE remover aula
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM classes WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;