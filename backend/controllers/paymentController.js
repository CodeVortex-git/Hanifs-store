function paymentIntegrationUnavailable(_req, res) {
  res.status(501).json({
    success: false,
    message: "Payment integration is not active yet.",
  });
}

module.exports = {
  initializePayment: paymentIntegrationUnavailable,
  verifyPayment: paymentIntegrationUnavailable,
};
