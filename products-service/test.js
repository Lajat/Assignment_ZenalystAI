/**
 * Basic API tests for products-service.
 * Run with: node test.js  (against a running instance + Postgres)
 * Not a full test suite — just enough to demonstrate the pattern and
 * give something concrete to defend live, per the assignment's ask.
 */
const assert = require("assert");

const BASE = process.env.TEST_BASE_URL || "http://localhost:8080/api/products";

async function run() {
  console.log("Running products-service tests against", BASE);

  // CREATE
  let res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Widget", price: 9.99 }),
  });
  assert.strictEqual(res.status, 201, "expected 201 on create");
  const created = await res.json();
  assert.strictEqual(created.name, "Test Widget");
  console.log("✓ POST /products creates a product");

  // GET (single)
  res = await fetch(`${BASE}/${created.id}`);
  assert.strictEqual(res.status, 200, "expected 200 on get by id");
  console.log("✓ GET /products/:id returns the created product");

  // GET (list) — should include the created item
  res = await fetch(BASE);
  const list = await res.json();
  assert.ok(list.items.some((p) => p.id === created.id), "created product should appear in list");
  console.log("✓ GET /products includes the created product");

  // Validation: missing fields
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "No price" }),
  });
  assert.strictEqual(res.status, 400, "expected 400 when price is missing");
  console.log("✓ POST /products rejects missing price");

  // DELETE
  res = await fetch(`${BASE}/${created.id}`, { method: "DELETE" });
  assert.strictEqual(res.status, 200, "expected 200 on delete");
  console.log("✓ DELETE /products/:id removes the product");

  // 404 after delete
  res = await fetch(`${BASE}/${created.id}`);
  assert.strictEqual(res.status, 404, "expected 404 after delete");
  console.log("✓ GET /products/:id returns 404 after delete");

  console.log("\nAll products-service tests passed.");
}

run().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
