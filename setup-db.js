const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  console.log('\n=== Database Setup Script ===\n');
  
  try {
    // First, connect without specifying database to create it if needed
    const dbHost = process.env.MYSQLHOST || process.env.DB_HOST;
    const dbPort = process.env.MYSQLPORT || process.env.DB_PORT;
    const dbUser = process.env.MYSQLUSER || process.env.DB_USER;
    const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
    const dbName = process.env.MYSQLDATABASE || process.env.DB_NAME;

    const missingDbVars = [];
    if (!dbHost) missingDbVars.push('MYSQLHOST or DB_HOST');
    if (!dbPort) missingDbVars.push('MYSQLPORT or DB_PORT');
    if (!dbUser) missingDbVars.push('MYSQLUSER or DB_USER');
    if (dbPassword == null || dbPassword === undefined) missingDbVars.push('MYSQLPASSWORD or DB_PASSWORD');
    if (!dbName) missingDbVars.push('MYSQLDATABASE or DB_NAME');
    if (missingDbVars.length) {
      throw new Error(`Missing required database environment variable(s): ${missingDbVars.join(', ')}. Set Railway vars or local env vars before running setup-db.`);
    }

    const tempPool = mysql.createPool({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPassword,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('Step 1: Creating database if it does not exist...');
    const dbConn = await tempPool.getConnection();
    
    await dbConn.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Database '${dbName}' ready\n`);
    dbConn.release();
    await tempPool.end();

    // Now connect to the specific database
    const pool = mysql.createPool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });

    console.log('Step 2: Creating Users table if it does not exist...');
    const conn = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS Users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        role ENUM('admin', 'manager', 'landlord', 'tenant', 'owner', 'student') NOT NULL DEFAULT 'tenant',
        tenant_id INT,
        staff_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await conn.query(createTableQuery);
    console.log('✅ Users table ready\n');

    // Create Owner table
    console.log('Step 3: Creating Owner table if it does not exist...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS Owner (
        owner_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        phone VARCHAR(30),
        city VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Owner table ready\n');

    // Create Property table
    console.log('Step 4: Creating Property table if it does not exist...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS Property (
        property_id INT AUTO_INCREMENT PRIMARY KEY,
        owner_id INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        address VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        type ENUM('Studio', '1BR', '2BR', '3BR', 'Villa') DEFAULT '2BR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES Owner(owner_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Property table ready\n');

    // Note: Unit table already exists in your database
    // If you need to create it, uncomment the code below:
    // console.log('Step 5: Creating Unit table if it does not exist...');
    // await conn.query(`
    //   CREATE TABLE IF NOT EXISTS unit (
    //     unit_id INT AUTO_INCREMENT PRIMARY KEY,
    //     property_id INT NOT NULL,
    //     unit_code VARCHAR(50) NOT NULL UNIQUE,
    //     unit_type VARCHAR(50),
    //     beds INT DEFAULT 1,
    //     monthly_rent DECIMAL(10, 2) NOT NULL,
    //     availability_status ENUM('Available', 'Reserved', 'Occupied') DEFAULT 'Available',
    //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    //     FOREIGN KEY (property_id) REFERENCES Property(property_id)
    //   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    // `);
    // console.log('✅ Unit table ready\n');

    // Check existing users
    console.log('Step 6: Checking users in database...');
    const [users] = await conn.query('SELECT COUNT(*) as count FROM Users');
    console.log(`Current users in database: ${users[0].count}\n`);

    if (users[0].count === 0) {
      console.log('Step 7: No users found. Database is ready for registration.\n');
    } else {
      console.log('Step 7: Database already has users.\n');
      const [userList] = await conn.query('SELECT user_id, email, full_name, role FROM Users LIMIT 5');
      console.log('Sample users:');
      userList.forEach(user => {
        console.log(`  - ${user.email} (${user.full_name}) - ${user.role}`);
      });
      console.log('');
    }

    // Check existing properties
    const [properties] = await conn.query('SELECT COUNT(*) as count FROM Property');
    console.log(`Properties in database: ${properties[0].count}\n`);

    conn.release();
    await pool.end();

    console.log('✅ Database setup complete! The application is ready to use.\n');
    console.log('Next steps:');
    console.log('  1. Seed properties: npm run seed-properties');
    console.log('  2. Seed users: npm run seed');
    console.log('  3. Start the server: npm start');
    console.log('  4. Open http://localhost:3000/auth.html\n');

  } catch (err) {
    console.error('❌ Setup failed!');
    console.error(`Error: ${err.message}\n`);
    
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('The MySQL user does not have the required permissions.');
      console.error('Please ensure:');
      console.error('  1. DB_USER has permissions to CREATE DATABASE');
      console.error('  2. DB_PASSWORD is correct\n');
    } else if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
      console.error('Cannot connect to MySQL. Please ensure:');
      console.error('  1. MySQL is running');
      console.error('  2. DB_HOST is correct (usually localhost)');
      console.error('  3. DB_PORT is correct (usually 3306)\n');
    }
    
    process.exit(1);
  }
})();
