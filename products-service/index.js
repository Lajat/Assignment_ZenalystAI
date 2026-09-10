const express = require("express");
const cors = require("cors");
const db = require("./db");
const routes = require("./routes");
const { INSTANCE_ID } = require("./controller");

const app = express();
app.use(express.json());
app.use(cors());
app.use(routes);

const PORT = 3000;

db.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`[${INSTANCE_ID}] listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to postgres:", err.message);
    process.exit(1);
  });
