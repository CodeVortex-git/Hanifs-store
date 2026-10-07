const service = require("../services/adminInventoryService");

function sendError(res, error) {
  if (error instanceof service.AdminInventoryError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Admin inventory request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "The inventory request could not be completed. Please try again." });
}

async function listInventory(req, res) {
  try {
    const result = await service.listInventory(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
}

async function getInventoryItem(req, res) {
  try {
    const result = await service.getInventoryItem(req.params.variantId);
    res.status(200).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
}

async function adjustInventory(req, res) {
  try {
    const result = await service.adjustInventory(req.params.variantId, req.body, req.adminAuth?.admin?.id);
    res.status(200).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
}

module.exports = { adjustInventory, getInventoryItem, listInventory };
