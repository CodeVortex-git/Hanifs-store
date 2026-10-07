const adminProductService = require("../services/adminProductService");

function sendError(res, error) {
  if (error instanceof adminProductService.AdminProductError) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  console.error("Admin product request failed:", error?.message || "Unknown error");
  res.status(500).json({ success: false, message: "The product request could not be completed. Please try again." });
}

async function listProducts(req, res) {
  try {
    const result = await adminProductService.listProducts(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) { sendError(res, error); }
}

async function getProduct(req, res) {
  try {
    const product = await adminProductService.getProduct(req.params.id);
    res.status(200).json({ success: true, product });
  } catch (error) { sendError(res, error); }
}

async function createProduct(req, res) {
  try {
    const product = await adminProductService.createProduct(req.body);
    res.status(201).json({ success: true, product });
  } catch (error) { sendError(res, error); }
}

async function updateProduct(req, res) {
  try {
    const product = await adminProductService.updateProduct(req.params.id, req.body);
    res.status(200).json({ success: true, product });
  } catch (error) { sendError(res, error); }
}

async function createVariant(req, res) {
  try {
    const variant = await adminProductService.createVariant(req.params.id, req.body);
    res.status(201).json({ success: true, variant });
  } catch (error) { sendError(res, error); }
}

async function updateVariant(req, res) {
  try {
    const variant = await adminProductService.updateVariant(req.params.id, req.params.variantId, req.body);
    res.status(200).json({ success: true, variant });
  } catch (error) { sendError(res, error); }
}

module.exports = { createProduct, createVariant, getProduct, listProducts, updateProduct, updateVariant };
