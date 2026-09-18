function createOrderPlaceholder(_req, res) {
  res.status(501).json({
    success: false,
    message: "Order creation is not active yet.",
  });
}

function getOrderPlaceholder(_req, res) {
  res.status(501).json({
    success: false,
    message: "Order retrieval is not active yet.",
  });
}

module.exports = {
  createOrder: createOrderPlaceholder,
  getOrder: getOrderPlaceholder,
};
