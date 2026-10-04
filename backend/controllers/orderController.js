const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({ success: true, order });
  } catch (error) {
    if (error instanceof orderService.OrderServiceError) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }

    console.error("Order creation failed:", error.message);
    res.status(500).json({
      success: false,
      message: "We could not create your order. Please try again.",
    });
  }
}

function getOrder(_req, res) {
  res.status(501).json({
    success: false,
    message: "Order lookup is not available yet.",
  });
}

module.exports = { createOrder, getOrder };
