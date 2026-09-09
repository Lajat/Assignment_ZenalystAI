/**
 * Basic API tests for invoice-service.
 * Run with: node test.js  (against a running instance + MongoDB)
 */
const assert = require("assert");

const BASE = process.env.TEST_BASE_URL || "http://localhost:8080/api/invoices";

async function run() {
  console.log("Running invoice-service tests against", BASE);

  // CREATE
  let res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer: "Test Customer", amount: 150.5 }),
  });
  assert.strictEqual(res.status, 201, "expected 201 on create");
  const created = await res.json();
  assert.strictEqual(created.customer, "Test Customer");
  console.log("✓ POST /invoices creates an invoice");

  // GET (single)
  res = await fetch(`${BASE}/${created._id}`);
  assert.strictEqual(res.status, 200, "expected 200 on get by id");
  console.log("✓ GET /invoices/:id returns the created invoice");

  // GET (list)
  res = await fetch(BASE);
  const list = await res.json();
  assert.ok(list.items.some((i) => i._id === created._id), "created invoice should appear in list");
  console.log("✓ GET /invoices includes the created invoice");

  // Validation: missing fields
  res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer: "No amount" }),
  });
  assert.strictEqual(res.status, 400, "expected 400 when amount is missing");
  console.log("✓ POST /invoices rejects missing amount");

  // DELETE
  res = await fetch(`${BASE}/${created._id}`, { method: "DELETE" });
  assert.strictEqual(res.status, 200, "expected 200 on delete");
  console.log("✓ DELETE /invoices/:id removes the invoice");

  // 404 after delete
  res = await fetch(`${BASE}/${created._id}`);
  assert.strictEqual(res.status, 404, "expected 404 after delete");
  console.log("✓ GET /invoices/:id returns 404 after delete");

  console.log("\nAll invoice-service tests passed.");
}

run().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
