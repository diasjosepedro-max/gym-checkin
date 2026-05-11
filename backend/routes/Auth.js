const router   = require('express').Router();
const db       = require('../db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'gym_secret_key';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e password obrigatórios' });

    // Verifica se já existe
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ error: 'Email já registado' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (email, password, name) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email, hash, name || email]
    );
    const token = jwt.sign({ id: rows[0].id, email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Email ou password incorretos' });

    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Email ou password incorretos' });

    const token = jwt.sign({ id: rows[0].id, email }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, name: rows[0].name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, email, name FROM users WHERE id=$1', [req.user.id]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;