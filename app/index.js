const express = require("express");
const { MongoClient } = require("mongodb");
const { Client: PgClient } = require("pg");

const app = express();
const PORT = 3000;

app.get("/health", (req, res) => {
  // Liveness check used by docker-compose healthcheck and nginx /health
  res.status(200).json({ status: "ok" });
});

app.get("/ready", async (req, res) => {
  // Readiness check: confirms both databases are actually reachable,
  // not just that the process is running.
  const results = { mongo: false, postgres: false };

  try {
    const mongo = new MongoClient(
      `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@mongo:27017`
    );
    await mongo.connect();
    await mongo.db().admin().ping();
    await mongo.close();
    results.mongo = true;
  } catch (e) {
    results.mongoError = e.message;
  }

  try {
    const pg = new PgClient({
      host: "postgres",
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    });
    await pg.connect();
    await pg.query("SELECT 1");
    await pg.end();
    results.postgres = true;
  } catch (e) {
    results.postgresError = e.message;
  }

  const allOk = results.mongo && results.postgres;
  res.status(allOk ? 200 : 503).json(results);
});

app.listen(PORT, () => {
  console.log(`App placeholder listening on port ${PORT}`);
});
