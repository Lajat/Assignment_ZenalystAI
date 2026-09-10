const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.get("/health", controller.health);
router.post("/products", controller.createProduct);
router.get("/products", controller.listProducts);
router.get("/products/:id", controller.getProduct);
router.delete("/products/:id", controller.deleteProduct);

module.exports = router;
