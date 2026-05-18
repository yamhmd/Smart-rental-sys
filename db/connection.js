const mysql = require('mysql2/promise');
require('dotenv').config();

// Support both Railway (MYSQLHOST, MYSQLUSER, etc.) and local (.env) variables
const dbHost = process.env.MYSQLHOST || process.env.DB_HOST;
const dbPort = process.env.MYSQLPORT || process.env.DB_PORT;
const dbUser = process.env.MYSQLUSER || process.env.DB_USER;
const dbPassword = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD;
const dbDatabase = process.env.MYSQLDATABASE || process.env.DB_NAME;

const missingDbVars = [];
if (!dbHost) missingDbVars.push('MYSQLHOST or DB_HOST');
if (!dbPort) missingDbVars.push('MYSQLPORT or DB_PORT');
if (!dbUser) missingDbVars.push('MYSQLUSER or DB_USER');
if (dbPassword == null || dbPassword === undefined) missingDbVars.push('MYSQLPASSWORD or DB_PASSWORD');
if (!dbDatabase) missingDbVars.push('MYSQLDATABASE or DB_NAME');
if (missingDbVars.length) {
  throw new Error(`Missing required database environment variable(s): ${missingDbVars.join(', ')}. Set Railway vars or local env vars before starting the app.`);
}

const dbConfig = {
  host: dbHost,
  port: Number(dbPort),
  user: dbUser,
  password: dbPassword,
  database: dbDatabase,
};

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function connectWithRetry(maxAttempts = 5, delayMs = 1000) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      const env = process.env.NODE_ENV || 'development';
      console.log(`✅ MySQL pool connected to ${dbDatabase}${env === 'production' ? ' (Railway)' : ' (local)'}`);
      return;
    } catch (err) {
      lastError = err;
      console.error(`⚠️  Connection attempt ${attempt} failed:`, err.code, err.message);
      if (attempt < maxAttempts) {
        console.log(`   Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error('❌ MySQL connection failed after', maxAttempts, 'attempts:', lastError?.message || 'Unknown error');
  console.error('   Please verify:');
  console.error('   1. MySQL/Railway database is running and accessible');
  console.error('   2. Environment variables are set (Railway or .env):');
  console.error('      - MYSQLHOST (or DB_HOST)');
  console.error('      - MYSQLPORT (or DB_PORT)');
  console.error('      - MYSQLUSER (or DB_USER)');
  console.error('      - MYSQLPASSWORD (or DB_PASSWORD)');
  console.error('      - MYSQLDATABASE (or DB_NAME)');
  console.error('   3. Database exists and Users table is created');
}

connectWithRetry();

module.exports = pool;
