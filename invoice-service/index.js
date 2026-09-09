const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const os = require("os");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const INSTANCE_ID = process.env.APP_NAME || `invoices-${os.hostname()}`;

let collection;

async function connectDb() {
  const client = new MongoClient(
    `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongo:27017`
  );
  await client.connect();
  collection = client.db("appdb").collection("invoices");
  console.log(`[${INSTANCE_ID}] connected to mongo`);
}

app.get("/health", (req, res) => res.json({ status: "ok", instance: INSTANCE_ID }));

// CREATE
app.post("/invoices", async (req, res) => {
  const { customer, amount } = req.body;
  if (!customer || amount === undefined) {
    return res.status(400).json({ error: "customer and amount are required" });
  }
  const doc = { customer, amount, createdAt: new Date() };
  const result = await collection.insertOne(doc);
  res.status(201).json({ _id: result.insertedId, ...doc, servedBy: INSTANCE_ID });
});

// READ (list)
app.get("/invoices", async (req, res) => {
  const items = await collection.find().sort({ createdAt: -1 }).toArray();
  res.json({ items, servedBy: INSTANCE_ID });
});

// READ (single)
app.get("/invoices/:id", async (req, res) => {
  const item = await collection.findOne({ _id: new ObjectId(req.params.id) });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json({ ...item, servedBy: INSTANCE_ID });
});

// DELETE
app.delete("/invoices/:id", async (req, res) => {
  const result = await collection.findOneAndDelete({ _id: new ObjectId(req.params.id) });
  if (!result) return res.status(404).json({ error: "not found" });
  res.json({ deleted: result, servedBy: INSTANCE_ID });
});

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[${INSTANCE_ID}] listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to mongo:", err.message);
    process.exit(1);
  });
