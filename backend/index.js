const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();

// CORS — permite todos os pedidos
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Rotas
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/members',  require('./routes/members'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/classes',  require('./routes/classes'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/payments', require('./routes/payments'));

// Health check
app.get('/', (req, res) => res.json({ status: 'GYM API online' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));