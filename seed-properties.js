require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  console.log('\n=== Seeding Properties into Database ===\n');

  try {
    const dbHost = process.env.MYSQLHOST || process.env.DB_HOST;
    const dbPort = process.env.MYSQLPORT || process.env.DB_PORT;
    const dbUser = process.env.MYSQLUSER || process.env.DB_USER;
    const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
    const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME;

    const pool = mysql.createPool({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    const conn = await pool.getConnection();

    // Check if we already have sample data
    const [existingUnits] = await conn.query('SELECT COUNT(*) as count FROM unit');
    if (existingUnits[0].count > 0) {
      console.log('✅ Properties already exist in database\n');
      console.log(`Current properties: ${existingUnits[0].count} units\n`);
      conn.release();
      await pool.end();
      return;
    }

    // Insert sample owners
    console.log('Seeding sample owners...');
    const owners = [
      ['Amina Rahman', 'amina@property.com', '+20-1000-123456', 'Cairo'],
      ['Nour El-Sayed', 'nour@property.com', '+20-1001-234567', 'Alexandria'],
      ['Hassan Ahmed', 'hassan@property.com', '+20-1002-345678', 'Giza'],
    ];

    const ownerIds = [];
    for (const [name, email, phone, city] of owners) {
      const [result] = await conn.query(
        'INSERT INTO Owner (name, email, phone, city) VALUES (?, ?, ?, ?)',
        [name, email, phone, city]
      );
      ownerIds.push(result.insertId);
      console.log(`  ✅ Added owner: ${name}`);
    }

    // Insert sample properties
    console.log('\nSeeding sample properties...');
    const properties = [
      [ownerIds[0], 'Modern Downtown Apartment', 'Zamalek Street 123', 'Cairo', 'Studio'],
      [ownerIds[0], 'Spacious Family Villa', 'Sheikh Zayed Main', 'Giza', 'Villa'],
      [ownerIds[1], 'Beachfront 2BR Flat', 'Mediterranean Coast Road', 'Alexandria', '2BR'],
      [ownerIds[1], 'Luxury Penthouse', 'New Cairo District', 'Cairo', '3BR'],
      [ownerIds[2], 'Student Dorm Studio', 'Near University', 'Giza', 'Studio'],
      [ownerIds[2], 'Cozy 1BR Apartment', 'Garden City', 'Cairo', '1BR'],
    ];

    const propertyIds = [];
    for (const [ownerId, name, address, city, type] of properties) {
      const [result] = await conn.query(
        'INSERT INTO Property (owner_id, name, address, city, type) VALUES (?, ?, ?, ?, ?)',
        [ownerId, name, address, city, type]
      );
      propertyIds.push(result.insertId);
      console.log(`  ✅ Added property: ${name}`);
    }

    // Insert sample units
    console.log('\nSeeding sample units...');
    const units = [
      [propertyIds[0], 'Z-001', 'Studio', 1, 3500, 'Available'],
      [propertyIds[1], 'SZ-001', '3BR', 3, 18000, 'Available'],
      [propertyIds[1], 'SZ-002', '3BR', 3, 18000, 'Reserved'],
      [propertyIds[2], 'BC-001', '2BR', 2, 12000, 'Available'],
      [propertyIds[3], 'NC-001', '3BR', 3, 25000, 'Available'],
      [propertyIds[4], 'UD-001', 'Studio', 1, 2800, 'Available'],
      [propertyIds[5], 'GC-001', '1BR', 1, 6500, 'Available'],
      [propertyIds[5], 'GC-002', '1BR', 1, 6500, 'Occupied'],
    ];

    for (const [propId, code, type, beds, rent, status] of units) {
      await conn.query(
        'INSERT INTO Unit (property_id, unit_code, unit_type, beds, monthly_rent, availability_status) VALUES (?, ?, ?, ?, ?, ?)',
        [propId, code, type, beds, rent, status]
      );
      console.log(`  ✅ Added unit: ${code} - ${type} - EGP ${rent}/mo`);
    }

    console.log('\n✅ Property seeding complete!\n');
    console.log('Summary:');
    console.log(`  - ${owners.length} owners`);
    console.log(`  - ${properties.length} properties`);
    console.log(`  - ${units.length} rental units\n`);
    console.log('You can now see properties on http://localhost:3000/properties.html');

    conn.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Seeding failed!');
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
