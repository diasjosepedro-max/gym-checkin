const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'gym_secret_key';

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token em falta' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token inválido' });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token expirado ou inválido' });
  }
};