require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db/connection');

const DEMO_USERS = [
  { email: 'admin@rental.com', password: 'admin123', full_name: 'Admin Office', role: 'admin' },
  { email: 'manager@rental.com', password: 'manager123', full_name: 'Amina Rahman', role: 'manager' },
  { email: 'tenant@rental.com', password: 'tenant123', full_name: 'Omar Khaled', role: 'tenant' },
  { email: 'owner@rental.com', password: 'owner123', full_name: 'Nour El-Sayed', role: 'landlord' },
];

(async () => {
  try {
    console.log('Seeding demo users...\n');
    for (const u of DEMO_USERS) {
      const [existing] = await pool.query(
        'SELECT user_id FROM Users WHERE email = ?',
        [u.email]
      );
      if (existing.length > 0) {
        console.log(`⏭️   ${u.email} already exists, skipping`);
        continue;
      }
      const hash = await bcrypt.hash(u.password, 10);
      await pool.query(
        'INSERT INTO Users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        [u.email, hash, u.full_name, u.role]
      );
      console.log(`✅  ${u.role.padEnd(8)} | ${u.email.padEnd(24)} | password: ${u.password}`);
    }

    try {
      const [tenants] = await pool.query('SELECT tenant_id FROM Tenant ORDER BY tenant_id LIMIT 1');
      if (tenants.length > 0) {
        await pool.query(
          'UPDATE Users SET tenant_id = ? WHERE email = ? AND tenant_id IS NULL',
          [tenants[0].tenant_id, 'tenant@rental.com']
        );
        console.log('\n✅  Linked tenant@rental.com to Tenant row', tenants[0].tenant_id);
      } else {
        console.log('\n⏭️   No rows in Tenant table — demo tenant user has no tenant_id (leases will be empty).');
      }
    } catch (e) {
      console.warn('\n⚠️   Could not link tenant_id:', e.message);
    }

    try {
      const [owners] = await pool.query('SELECT owner_id FROM Owner ORDER BY owner_id LIMIT 1');
      if (owners.length > 0) {
        await pool.query(
          'UPDATE Users SET staff_id = ? WHERE email = ? AND staff_id IS NULL',
          [owners[0].owner_id, 'owner@rental.com']
        );
        console.log('✅  Linked owner@rental.com to Owner row', owners[0].owner_id);
      } else {
        console.log('⏭️   No rows in Owner table — demo landlord user has no owner link.');
      }
    } catch (e) {
      console.warn('⚠️   Could not link owner row:', e.message);
    }

    console.log('\nDone.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
  }
})();
