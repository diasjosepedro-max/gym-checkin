const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

db.query(`ALTER TABLE financial_clients ADD COLUMN IF NOT EXISTS has_invoice BOOLEAN DEFAULT false`).catch(() => {});

db.query(`
  CREATE TABLE IF NOT EXISTS teacher_month_totals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    month VARCHAR(3) NOT NULL,
    year INTEGER NOT NULL,
    session_count INTEGER NOT NULL DEFAULT 0,
    is_expense BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(teacher_id, month, year)
  )
`).catch(() => {});

// ── CLIENTES ──────────────────────────────────────────────────────────
router.get('/clients', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT fc.*, t.name AS professor_name
      FROM financial_clients fc
      LEFT JOIN teachers t ON fc.professor_id = t.id
      ORDER BY fc.name
    `);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/clients', auth, async (req, res) => {
  try {
    const { name, type, sessions, has_pack, has_insurance, has_invoice, professor_id, standard_value, value_to_professor } = req.body;
    const { rows } = await db.query(`
      INSERT INTO financial_clients (name, type, sessions, has_pack, has_insurance, has_invoice, professor_id, standard_value, value_to_professor)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, type||'PT', sessions||'1x', has_pack||false, has_insurance||false, has_invoice||false, professor_id||null, standard_value||0, value_to_professor||0]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/clients/:id', auth, async (req, res) => {
  try {
    const { name, type, sessions, active, has_pack, has_insurance, has_invoice, professor_id, standard_value, value_to_professor } = req.body;

    const { rows: old } = await db.query('SELECT name FROM financial_clients WHERE id=$1', [req.params.id]);
    const oldName = old[0]?.name;

    const { rows } = await db.query(`
      UPDATE financial_clients SET name=$1,type=$2,sessions=$3,active=$4,has_pack=$5,
      has_insurance=$6,has_invoice=$7,professor_id=$8,standard_value=$9,value_to_professor=$10
      WHERE id=$11 RETURNING *`,
      [name, type, sessions, active, has_pack, has_insurance, has_invoice||false, professor_id||null, standard_value, value_to_professor, req.params.id]
    );

    if (oldName && name && oldName !== name) {
      await db.query('UPDATE members SET name=$1 WHERE lower(trim(name))=lower(trim($2))', [name, oldName]);
    }

    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── VALORES MENSAIS ───────────────────────────────────────────────────
router.get('/values', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.query;
    const q = month
      ? `SELECT fv.*,fc.name,fc.type,fc.sessions,fc.has_pack,fc.standard_value,fc.value_to_professor,fc.professor_id,t.name AS professor_name
         FROM financial_values fv
         JOIN financial_clients fc ON fv.client_id=fc.id
         LEFT JOIN teachers t ON fv.monthly_professor_id=t.id
         WHERE fv.month=$1 AND fv.year=$2`
      : `SELECT fv.*,fc.name,fc.type,fc.sessions,fc.has_pack,fc.standard_value,fc.value_to_professor
         FROM financial_values fv
         JOIN financial_clients fc ON fv.client_id=fc.id
         WHERE fv.year=$1`;
    const { rows } = await db.query(q, month ? [month, year] : [year]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/values', auth, async (req, res) => {
  try {
    const { client_id, month, year=new Date().getFullYear(), value, professor_value, monthly_professor_id, monthly_has_pack, is_new_standard } = req.body;

    const { rows } = await db.query(`
      INSERT INTO financial_values (client_id,month,year,value,professor_value,monthly_professor_id,monthly_has_pack,is_new_standard)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (client_id,month,year) DO UPDATE SET
        value=$4, professor_value=$5, monthly_professor_id=$6, monthly_has_pack=$7, is_new_standard=$8
      RETURNING *`,
      [client_id, month, year, value, professor_value||0, monthly_professor_id||null, monthly_has_pack, is_new_standard||false]
    );

    // Se "novo standard", atualiza o cartão do cliente
    if (is_new_standard) {
      await db.query(`
        UPDATE financial_clients SET standard_value=$1, value_to_professor=$2,
        professor_id=COALESCE($3, professor_id), has_pack=COALESCE($4, has_pack)
        WHERE id=$5`,
        [value, professor_value||0, monthly_professor_id||null, monthly_has_pack, client_id]
      );
    }
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Copiar valores do mês anterior (ou do standard) para um mês
router.post('/values/copy-month', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.body;
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mIdx = MONTHS.indexOf(month);
    const prevMonth = mIdx > 0 ? MONTHS[mIdx-1] : null;

    // Busca todos os clientes ativos
    const { rows: clients } = await db.query('SELECT * FROM financial_clients WHERE active=true');

    for (const c of clients) {
      // Verifica se já existe valor para este mês
      const { rows: existing } = await db.query(
        'SELECT id FROM financial_values WHERE client_id=$1 AND month=$2 AND year=$3',
        [c.id, month, year]
      );
      if (existing.length > 0) continue; // já existe, não sobrescreve

      // Tenta copiar do mês anterior
      let val = c.standard_value || 0;
      let profVal = c.value_to_professor || 0;
      let profId = c.professor_id || null;
      let hasPack = c.has_pack;

      if (prevMonth) {
        const { rows: prev } = await db.query(
          'SELECT * FROM financial_values WHERE client_id=$1 AND month=$2 AND year=$3',
          [c.id, prevMonth, year]
        );
        if (prev.length > 0) {
          val = prev[0].value;
          profVal = prev[0].professor_value || profVal;
          profId = prev[0].monthly_professor_id || profId;
          hasPack = prev[0].monthly_has_pack ?? hasPack;
        }
      }

      await db.query(`
        INSERT INTO financial_values (client_id,month,year,value,professor_value,monthly_professor_id,monthly_has_pack)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT DO NOTHING`,
        [c.id, month, year, val, profVal, profId, hasPack]
      );
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PAGAMENTOS ────────────────────────────────────────────────────────
router.get('/payments', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.query;
    const q = month
      ? 'SELECT fp.*,fc.name,fc.type FROM financial_payments fp JOIN financial_clients fc ON fp.client_id=fc.id WHERE fp.month=$1 AND fp.year=$2'
      : 'SELECT fp.*,fc.name,fc.type FROM financial_payments fp JOIN financial_clients fc ON fp.client_id=fc.id WHERE fp.year=$1';
    const { rows } = await db.query(q, month ? [month, year] : [year]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/payments', auth, async (req, res) => {
  try {
    const { client_id, month, year=new Date().getFullYear(), paid, payment_date } = req.body;
    const { rows } = await db.query(`
      INSERT INTO financial_payments (client_id,month,year,paid,payment_date)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (client_id,month,year) DO UPDATE SET paid=$4,payment_date=$5,updated_at=NOW()
      RETURNING *`,
      [client_id, month, year, paid, payment_date||'']
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payments/reset', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.body;
    await db.query('DELETE FROM financial_payments WHERE month=$1 AND year=$2', [month, year]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CUSTOS FIXOS ──────────────────────────────────────────────────────
router.get('/costs', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.query;
    const q = month
      ? 'SELECT * FROM financial_costs WHERE month=$1 AND year=$2 ORDER BY type,label'
      : 'SELECT * FROM financial_costs WHERE year=$1 ORDER BY month,type,label';
    const { rows } = await db.query(q, month ? [month, year] : [year]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/costs', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear(), label, value, type='regular', expense_date } = req.body;
    const { rows } = await db.query(`
      INSERT INTO financial_costs (month,year,label,value,type,expense_date)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (month,year,label) DO UPDATE SET value=$4,type=$5,expense_date=$6 RETURNING *`,
      [month, year, label, value, type, expense_date||null]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/costs/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM financial_costs WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PROFESSORES ───────────────────────────────────────────────────────
router.get('/teachers', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM teachers ORDER BY name');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/teachers', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const { rows } = await db.query('INSERT INTO teachers (name) VALUES ($1) RETURNING *', [name]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/teachers/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM teachers WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/teacher-costs', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.query;
    const q = month
      ? 'SELECT ftc.*,t.name FROM financial_teacher_costs ftc JOIN teachers t ON ftc.teacher_id=t.id WHERE ftc.month=$1 AND ftc.year=$2'
      : 'SELECT ftc.*,t.name FROM financial_teacher_costs ftc JOIN teachers t ON ftc.teacher_id=t.id WHERE ftc.year=$1';
    const { rows } = await db.query(q, month ? [month, year] : [year]);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/teacher-costs', auth, async (req, res) => {
  try {
    const { teacher_id, month, year=new Date().getFullYear(), value } = req.body;
    const { rows } = await db.query(`
      INSERT INTO financial_teacher_costs (teacher_id,month,year,value)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (teacher_id,month,year) DO UPDATE SET value=$4 RETURNING *`,
      [teacher_id, month, year, value]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/teachers/:id/session-value', auth, async (req, res) => {
  try {
    const { value_per_session } = req.body;
    const { rows } = await db.query('UPDATE teachers SET value_per_session=$1 WHERE id=$2 RETURNING *', [value_per_session, req.params.id]);
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TOTAIS MENSAIS DE PROFESSORES ─────────────────────────────────────
router.get('/teacher-month-totals', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const { rows } = await db.query(
      'SELECT * FROM teacher_month_totals WHERE month=$1 AND year=$2',
      [month, year]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/teacher-month-totals', auth, async (req, res) => {
  try {
    const { teacher_id, month, year, session_count, is_expense } = req.body;
    const { rows } = await db.query(`
      INSERT INTO teacher_month_totals (teacher_id, month, year, session_count, is_expense)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (teacher_id, month, year)
      DO UPDATE SET session_count=$4, is_expense=$5
      RETURNING *`,
      [teacher_id, month, year, Number(session_count)||0, is_expense||false]
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SESSÕES DE PROFESSORES ────────────────────────────────────────────
router.get('/teacher-sessions', auth, async (req, res) => {
  try {
    const { teacher_id, month, year=new Date().getFullYear() } = req.query;
    const { rows } = await db.query(`
      SELECT fts.*,ft.name,ft.value_per_session FROM financial_teacher_sessions fts
      JOIN teachers ft ON fts.teacher_id=ft.id
      WHERE fts.teacher_id=$1 AND fts.month=$2 AND fts.year=$3 ORDER BY fts.session_date`,
      [teacher_id, month, year]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/teacher-sessions/month', auth, async (req, res) => {
  try {
    const { month, year=new Date().getFullYear() } = req.query;
    const { rows } = await db.query(`
      SELECT fts.*,ft.name,ft.value_per_session FROM financial_teacher_sessions fts
      JOIN teachers ft ON fts.teacher_id=ft.id
      WHERE fts.month=$1 AND fts.year=$2 ORDER BY ft.name,fts.session_date`,
      [month, year]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/teacher-sessions', auth, async (req, res) => {
  try {
    const { teacher_id, session_date, month, year=new Date().getFullYear(), notes } = req.body;
    const { rows } = await db.query(`
      INSERT INTO financial_teacher_sessions (teacher_id,session_date,month,year,notes)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [teacher_id, session_date, month, year, notes||'']
    );
    res.json(rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/teacher-sessions/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM financial_teacher_sessions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RESUMO ANUAL ──────────────────────────────────────────────────────
router.get('/annual', auth, async (req, res) => {
  try {
    const { year=new Date().getFullYear() } = req.query;
    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const [values, payments, costs, teachers, monthTotals, clients] = await Promise.all([
      db.query('SELECT * FROM financial_values WHERE year=$1', [year]),
      db.query('SELECT * FROM financial_payments WHERE year=$1', [year]),
      db.query('SELECT * FROM financial_costs WHERE year=$1', [year]),
      db.query('SELECT * FROM teachers'),
      db.query('SELECT * FROM teacher_month_totals WHERE year=$1', [year]),
      db.query('SELECT id, active, has_invoice FROM financial_clients'),
    ]);
    const teacherById = new Map(teachers.rows.map(t => [t.id, t]));
    const clientById  = new Map(clients.rows.map(c => [c.id, c]));
    // Espelha o filtro "withVal" do resumo mensal: só clientes atualmente ativos
    // e com valor > 0, para não contar clientes desativados/duplicados nos históricos
    const activeValues = values.rows.filter(v => clientById.get(v.client_id)?.active && Number(v.value) > 0);
    const result = MONTHS.map(month => {
      const mVals  = activeValues.filter(v => v.month===month);
      const mPays  = payments.rows.filter(p => p.month===month);
      const mCosts = costs.rows.filter(c => c.month===month);
      const mMT    = monthTotals.rows.filter(t => t.month===month);
      const previsto = mVals.reduce((s,v) => s+Number(v.value), 0);
      const recebido = mVals.filter(v => mPays.find(p => p.client_id===v.client_id && p.paid)).reduce((s,v) => s+Number(v.value), 0);
      // Despesas fixas (regulares + esporádicas)
      const fixedCosts = mCosts.reduce((s,c) => s+Number(c.value), 0);
      // Custo dos professores por sessão (sessões × valor/sessão, apenas confirmadas como despesa)
      const teacherSessionCosts = mMT.reduce((s,t) => {
        if (!t.is_expense) return s;
        return s + Number(t.session_count) * Number(teacherById.get(t.teacher_id)?.value_per_session || 0);
      }, 0);
      // Valor pago a professores por cliente
      const professorClientCosts = mVals.reduce((s,v) => s+Number(v.professor_value||0), 0);
      // IVA (23%) para clientes com fatura
      const ivaTotal = mVals.reduce((s,v) => {
        return clientById.get(v.client_id)?.has_invoice ? s + Number(v.value)*0.23 : s;
      }, 0);
      const custos = fixedCosts + teacherSessionCosts + professorClientCosts + ivaTotal;
      return { month, previsto, recebido, custos, lucro: recebido-custos };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;