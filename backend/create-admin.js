const db     = require('./db');
const bcrypt = require('bcryptjs');

async function main() {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('Define ADMIN_EMAIL e ADMIN_PASSWORD como variáveis de ambiente antes de correr este script.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password=$2, name=$3',
    [email, hash, name]
  );
  console.log('Admin criado com sucesso!');
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });