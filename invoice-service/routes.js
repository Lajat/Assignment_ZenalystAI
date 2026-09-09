const express = require("express");
const controller = require("./controller");

const router = express.Router();

router.get("/health", controller.health);
router.post("/invoices", controller.createInvoice);
router.get("/invoices", controller.listInvoices);
router.get("/invoices/:id", controller.getInvoice);
router.delete("/invoices/:id", controller.deleteInvoice);

module.exports = router;
