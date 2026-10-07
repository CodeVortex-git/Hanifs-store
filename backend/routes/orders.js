// Order routes.
//
// The frontend will eventually POST here to request order creation. This endpoint
// is the single trusted entry point for an order: it must validate the requested
// items against authoritative product data and calculate pricing itself. Never
// accept a client-supplied price, total, or status.

const express = require("express");
const { createOrder, getOrder, listOrders } = require("../controllers/orderController");
const { authenticateSession, protectCsrf, requireAuthentication } = require("../middleware/auth");
const { getDeliveryQuote } = require("../controllers/deliveryController");

const router = express.Router();

router.post("/", authenticateSession, protectCsrf, createOrder);
router.get("/delivery-quote", getDeliveryQuote);
router.get("/", authenticateSession, requireAuthentication, listOrders);
router.get("/:id", authenticateSession, requireAuthentication, getOrder);

module.exports = router;
