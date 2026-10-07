const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/deliveryController");
const { authenticateSession, requireAuthentication } = require("../middleware/auth");

router.get("/:id/delivery", authenticateSession, requireAuthentication, deliveryController.getCustomerDelivery);

module.exports = router;
