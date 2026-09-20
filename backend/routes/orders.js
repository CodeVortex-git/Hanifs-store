// Order routes.
//
// The frontend will eventually POST here to request order creation. This endpoint
// is the single trusted entry point for an order: it must validate the requested
// items against authoritative product data and calculate pricing itself. Never
// accept a client-supplied price, total, or status.

const express = require("express");
const { createOrder, getOrder } = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);
router.get("/:id", getOrder);

module.exports = router;
