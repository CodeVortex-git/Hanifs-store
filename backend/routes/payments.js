// Payment routes.
//
// Payment endpoints are the boundary where the browser stops being trusted.
// The frontend may request that a payment be started or checked, but the actual
// provider call uses backend-only credentials and the resulting payment status
// must be confirmed server-side before any order is marked paid.

const express = require("express");
const {
  initializePayment,
  verifyPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/initialize", initializePayment);
router.post("/verify", verifyPayment);

module.exports = router;
