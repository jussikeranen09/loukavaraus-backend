const mysql = require('mysql2/promise');

// Määritä yhteystiedot
const pool = mysql.createPool({
  user: 'u23_gwYuixfeOG',
  host: '185.176.94.192',
  database: 's23_classrooms',
  password: 'qomTL!2zGU4h5JnD!Y+tWueI',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
module.exports = pool;