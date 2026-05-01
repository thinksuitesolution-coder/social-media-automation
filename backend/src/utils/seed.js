require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('./firebase');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@socialai.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const existing = await db.collection('admins').where('email', '==', email).get();
  if (!existing.empty) {
    console.log('Admin already exists:', email);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const ref = await db.collection('admins').add({
    email,
    password: hashed,
    createdAt: new Date().toISOString(),
  });
  console.log('Admin seeded:', email, '| ID:', ref.id);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
