const { MongoClient } = require("mongodb");

let collection;

async function connect() {
  const client = new MongoClient(
    `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongo:27017`
  );
  await client.connect();
  collection = client.db("appdb").collection("invoices");
  return collection;
}

function getCollection() {
  if (!collection) throw new Error("Database not connected — call connect() first");
  return collection;
}

module.exports = { connect, getCollection };
