const { ObjectId } = require("mongodb");
const { getCollection } = require("./db");
const os = require("os");

// INSTANCE_NAME is set explicitly per replica in docker-compose.yml
// (not derived from hostname) — used in every response so the UI can
// show exactly which replica handled the request.
const INSTANCE_ID = process.env.INSTANCE_NAME || `invoices-${os.hostname()}`;

async function createInvoice(req, res) {
  const { customer, amount } = req.body;
  if (!customer || amount === undefined) {
    return res.status(400).json({ error: "customer and amount are required" });
  }
  const doc = { customer, amount, createdAt: new Date() };
  const result = await getCollection().insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc, servedBy: INSTANCE_ID });
}

async function listInvoices(req, res) {
  const items = await getCollection().find().sort({ createdAt: -1 }).toArray();
  res.json({ items, servedBy: INSTANCE_ID });
}

async function getInvoice(req, res) {
  const item = await getCollection().findOne({ _id: new ObjectId(req.params.id) });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json({ ...item, servedBy: INSTANCE_ID });
}

async function deleteInvoice(req, res) {
  const result = await getCollection().findOneAndDelete({ _id: new ObjectId(req.params.id) });
  if (!result) return res.status(404).json({ error: "not found" });
  res.json({ deleted: result, servedBy: INSTANCE_ID });
}

function health(req, res) {
  res.json({ status: "ok", instance: INSTANCE_ID });
}

module.exports = { createInvoice, listInvoices, getInvoice, deleteInvoice, health, INSTANCE_ID };
