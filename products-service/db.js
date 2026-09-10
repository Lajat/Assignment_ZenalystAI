const { Client } = require("pg");

let db;

async function connect() {
  db = new Client({
    host: "postgres",
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  });
  await db.connect();
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  return db;
}

function getDb() {
  if (!db) throw new Error("Database not connected — call connect() first");
  return db;
}

module.exports = { connect, getDb };
