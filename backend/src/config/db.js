const { Pool } = require("pg");
require("dotenv").config();

// Postgres local (Windows) y el contenedor "basedatos" de Docker Compose no
// soportan SSL; solo las bases en la nube (Render/Railway/etc.) lo requieren.
const esLocal = /localhost|127\.0\.0\.1|@basedatos[:/]/.test(process.env.DATABASE_URL || "");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: esLocal ? false : { rejectUnauthorized: false },
});

module.exports = pool;
