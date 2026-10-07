const orderService = require("../services/orderService");

async function createOrder(req, res) {
  try {
    const order = await orderService.createOrder(req.body, req.auth?.user?.id ?? null);
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

async function listOrders(req, res) {
  try {
    const result = await orderService.listCustomerOrders(req.auth.user.id, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendOrderError(res, error, "We could not load your orders. Please try again.");
  }
}

async function getOrder(req, res) {
  try {
    const order = await orderService.getCustomerOrder(req.auth.user.id, req.params.id);
    res.status(200).json({ success: true, order });
  } catch (error) {
    sendOrderError(res, error, "We could not load this order. Please try again.");
  }
}

function sendOrderError(res, error, genericMessage) {
  if (error instanceof orderService.OrderServiceError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Order lookup failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: genericMessage });
}

module.exports = { createOrder, getOrder, listOrders };
