const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origem não permitida'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas tentativas. Tenta novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);

// Rotas
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/members',  require('./routes/members'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/classes',  require('./routes/classes'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/finance',    require('./routes/finance'));
app.use('/api/trainings',  require('./routes/trainings'));

// Health check
app.get('/', (req, res) => res.json({ status: 'GYM API online' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));