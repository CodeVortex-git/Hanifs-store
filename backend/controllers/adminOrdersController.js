const service = require("../services/adminOrdersService");

function sendError(res, error) {
  if (error instanceof service.AdminOrdersError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Admin order request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "The order request could not be completed. Please try again." });
}

async function listOrders(req, res) {
  try {
    const result = await service.listOrders(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
}

async function getOrder(req, res) {
  try {
    const result = await service.getOrder(req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateOrderStatus(req, res) {
  try {
    const result = await service.updateOrderStatus(req.params.id, req.body, req.adminAuth?.admin?.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = { listOrders, getOrder, updateOrderStatus };
