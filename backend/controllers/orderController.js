// Order controllers.
//
// SECURITY NOTE — the browser is never the authority for order data.
// The frontend sends *requests*: product IDs, quantities, selected variants,
// and customer/shipping information. The backend must independently:
//   1. load authoritative product records (prices and stock) from the database,
//   2. validate that every requested item and variant is real and available,
//   3. calculate the authoritative totals server-side,
//   4. persist the order and drive its status transitions.
// Client-supplied prices, totals, stock levels, and order/payment status must
// always be discarded and recalculated rather than trusted.
//
// There is no database yet, so these endpoints deliberately do not create or
// read orders. They report that persistence is not implemented instead of
// pretending an order was stored.

const ORDER_STORAGE_PENDING_MESSAGE =
  "Persistent order storage will be implemented after the database milestone.";

// POST /api/orders
//
// Development endpoint. It does not create an order and does not return a fake
// order id or a fake total, because the backend cannot yet validate products or
// prices. Once the database milestone lands, this will:
//   - validate the requested items and shipping payload,
//   - create a PENDING order using server-calculated pricing,
//   - move it to PAYMENT_PENDING before payment initialization.
function createOrder(_req, res) {
  res.status(501).json({
    success: false,
    message: ORDER_STORAGE_PENDING_MESSAGE,
  });
}

// GET /api/orders/:id
//
// Development endpoint. No order can exist yet because nothing is persisted,
// so this reports that lookup is not implemented rather than returning a
// placeholder order.
function getOrder(_req, res) {
  res.status(501).json({
    success: false,
    message: ORDER_STORAGE_PENDING_MESSAGE,
  });
}

module.exports = { createOrder, getOrder };
