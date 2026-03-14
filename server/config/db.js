/**
 * Database Configuration
 * Initializes and exports a MySQL connection pool using environment variables.
 */
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Ping the database to verify the connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database Connection Failed:', err.message);
    } else {
        console.log('✅ Connected to MySQL Database!');
        connection.release(); // Always release the connection back to the pool
    }
});

// Export the promise-wrapper to allow async/await usage in controllers
module.exports = pool.promise();