const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  console.log('\n=== Registration Issue Diagnostic ===\n');
  
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
    throw new Error(`Missing required database environment variable(s): ${missingDbVars.join(', ')}. Set Railway vars or local env vars before running this check.`);
  }

  console.log('Database Configuration:');
  console.log(`  Host: ${dbHost}`);
  console.log(`  Port: ${dbPort}`);
  console.log(`  User: ${dbUser}`);
  console.log(`  Database: ${dbName}\n`);
  
  try {
    console.log('Attempting database connection...');
    const pool = mysql.createPool({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    const conn = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL!\n');
    
    // Check database
    const [dbRows] = await conn.query('SELECT DATABASE() AS db, USER() AS user');
    console.log('Current Connection:');
    console.log(`  Database: ${dbRows[0].db}`);
    console.log(`  User: ${dbRows[0].user}\n`);
    
    // Check if Users table exists
    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Users'`,
      [dbName]
    );
    
    if (tableRows.length > 0) {
      console.log('✅ Users table exists\n');
      
      // Check Users table schema
      const [columns] = await conn.query('DESCRIBE Users');
      console.log('Users table schema:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Check for sample user
      const [users] = await conn.query('SELECT COUNT(*) as count FROM Users');
      console.log(`\n  Total users: ${users[0].count}`);
    } else {
      console.log('❌ Users table does NOT exist\n');
      console.log('   Please create the Users table with the following schema:');
      console.log(`
CREATE TABLE Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('admin', 'manager', 'landlord', 'tenant', 'owner', 'student') NOT NULL DEFAULT 'tenant',
  tenant_id INT,
  staff_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
      `);
    }
    
    conn.release();
    await pool.end();
    
  } catch (err) {
    console.log('❌ Connection failed!\n');
    console.log('Error Details:');
    console.log(`  Code: ${err.code}`);
    console.log(`  Message: ${err.message}\n`);
    
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('  Cause: Username/password incorrect\n');
      console.log('  Solution:');
      console.log('    1. Verify .env file has correct DB_USER and DB_PASSWORD');
      console.log('    2. Verify MySQL is running');
      console.log('    3. Try connecting manually: mysql -u root -p -h localhost\n');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.log('  Cause: Database does not exist\n');
      console.log('  Solution:');
      console.log('    1. Create the database: CREATE DATABASE srs;\n');
    } else if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('  Cause: MySQL server is not running\n');
      console.log('  Solution:');
      console.log('    1. Start MySQL service');
      console.log('    2. On Windows: Start MySQL80 service from Services');
      console.log('    3. On Mac: brew services start mysql\n');
    }
  }
})();
