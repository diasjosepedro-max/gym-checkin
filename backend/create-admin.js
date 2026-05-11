const db     = require('./db');
const bcrypt = require('bcryptjs');

async function main() {
  const email    = 'dias.supreme@gmail.com';
  const password = 'Habitus.Q1!';
  const name     = 'Admin';

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password=$2, name=$3',
    [email, hash, name]
  );
  console.log('Admin criado com sucesso!');
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });