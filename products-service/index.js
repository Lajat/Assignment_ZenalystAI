const express = require("express");
const cors = require("cors");
const { Client } = require("pg");
const os = require("os");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
// Identifies which replica served the request — used live in the demo
// to prove nginx is actually load-balancing across instances.
const INSTANCE_ID = process.env.APP_NAME || `products-${os.hostname()}`;

let db;

async function connectDb() {
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
  console.log(`[${INSTANCE_ID}] connected to postgres`);
}

app.get("/health", (req, res) => res.json({ status: "ok", instance: INSTANCE_ID }));

// CREATE
app.post("/products", async (req, res) => {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: "name and price are required" });
  }
  const result = await db.query(
    "INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *",
    [name, price]
  );
  res.status(201).json({ ...result.rows[0], servedBy: INSTANCE_ID });
});

// READ (list)
app.get("/products", async (req, res) => {
  const result = await db.query("SELECT * FROM products ORDER BY id DESC");
  res.json({ items: result.rows, servedBy: INSTANCE_ID });
});

// READ (single)
app.get("/products/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "not found" });
  res.json({ ...result.rows[0], servedBy: INSTANCE_ID });
});

// DELETE
app.delete("/products/:id", async (req, res) => {
  const result = await db.query("DELETE FROM products WHERE id = $1 RETURNING *", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "not found" });
  res.json({ deleted: result.rows[0], servedBy: INSTANCE_ID });
});

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[${INSTANCE_ID}] listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to postgres:", err.message);
    process.exit(1);
  });
