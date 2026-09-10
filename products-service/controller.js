const { getDb } = require("./db");
const os = require("os");

// INSTANCE_NAME is set explicitly per replica in docker-compose.yml
// (not derived from hostname) — used in every response so the UI can
// show exactly which replica handled the request.
const INSTANCE_ID = process.env.INSTANCE_NAME || `products-${os.hostname()}`;

async function createProduct(req, res) {
  const { name, price } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ error: "name and price are required" });
  }
  const result = await getDb().query(
    "INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *",
    [name, price]
  );
  res.status(201).json({ ...result.rows[0], servedBy: INSTANCE_ID });
}

async function listProducts(req, res) {
  const result = await getDb().query("SELECT * FROM products ORDER BY id DESC");
  res.json({ items: result.rows, servedBy: INSTANCE_ID });
}

async function getProduct(req, res) {
  const result = await getDb().query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "not found" });
  res.json({ ...result.rows[0], servedBy: INSTANCE_ID });
}

async function deleteProduct(req, res) {
  const result = await getDb().query("DELETE FROM products WHERE id = $1 RETURNING *", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "not found" });
  res.json({ deleted: result.rows[0], servedBy: INSTANCE_ID });
}

function health(req, res) {
  res.json({ status: "ok", instance: INSTANCE_ID });
}

module.exports = { createProduct, listProducts, getProduct, deleteProduct, health, INSTANCE_ID };
