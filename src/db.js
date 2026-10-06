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

// Tee kysely tietokantaan
async function haeData() {
  try {
    // mysql2/promise palauttaa taulukon, jossa ensimmäisenä elementtinä ovat rivit (tulokset)
    const [tulos] = await pool.query('SELECT * FROM kayttajat');
    console.log(tulos);
  } catch (virhe) {
    console.error('Virhe tietokantayhteydessä:', virhe);
  }
}

haeData();