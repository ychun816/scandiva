// Create (or promote) an admin user with a real, caller-chosen password.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='Strong-Pass-123' node scripts/create_admin.js
//
// Refuses to run without a strong password — no known/default credentials are
// ever written to the database.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../src/lib/validators');

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> node scripts/create_admin.js');
    process.exit(1);
  }
  const pwError = validatePassword(password);
  if (pwError) {
    console.error(`Weak password: ${pwError}`);
    process.exit(1);
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { isAdmin: true, password: hashed },
      create: { email, password: hashed, name: 'Admin', isAdmin: true },
    });
    console.log('✅ Admin ready:', user.email);
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
