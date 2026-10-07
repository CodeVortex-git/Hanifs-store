const deliveryService = require("../services/deliveryService");

function sendError(res, error) {
  if (error instanceof deliveryService.DeliveryServiceError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }

  console.error("Delivery request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "We could not complete that delivery request. Please try again." });
}

async function getDelivery(req, res) {
  try {
    const result = await deliveryService.getAdminDelivery(req.params.id);
    res.status(200).json({ success: true, delivery: result });
  } catch (error) {
    sendError(res, error);
  }
}

async function getAdminDelivery(req, res) {
  return getDelivery(req, res);
}

async function getCustomerDelivery(req, res) {
  try {
    const result = await deliveryService.getCustomerDelivery(req.auth?.user?.id, req.params.id);
    res.status(200).json({ success: true, delivery: result });
  } catch (error) {
    sendError(res, error);
  }
}

function getDeliveryQuote(req, res) {
  try {
    const quote = deliveryService.parseDeliveryQuote(req.query);
    res.status(200).json({ success: true, ...quote, currency: "NGN" });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateDelivery(req, res) {
  try {
    const result = await deliveryService.updateDelivery(req.params.id, req.body, req.adminAuth?.admin?.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = { getAdminDelivery, getCustomerDelivery, getDeliveryQuote, updateDelivery };
