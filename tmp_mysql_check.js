const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
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

    const pool = mysql.createPool({
      host: dbHost,
      port: Number(dbPort),
      user: dbUser,
      password: dbPassword,
      database: dbName,
    });

    const conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT DATABASE() AS db, USER() AS user');
    console.log(JSON.stringify(rows[0]));
    conn.release();
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.code, e.message);
    process.exit(1);
  }
})();
