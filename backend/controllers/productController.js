const {
  getActiveProducts,
  getActiveProductById,
} = require("../services/productService");

async function listProducts(_req, res) {
  try {
    const products = await getActiveProducts();
    res.status(200).json({ products });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
}

async function getProduct(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(404).json({ success: false, message: "Product not found." });
    return;
  }

  try {
    const product = await getActiveProductById(id);
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    res.status(200).json({ product });
  } catch {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve product.",
    });
  }
}

module.exports = { listProducts, getProduct };
