// HANIF'S STORE — Express API foundation.
//
// ARCHITECTURAL BOUNDARY (frontend -> backend)
// Target flow for the eventual full-stack implementation:
//
//   Frontend
//     -> POST /api/orders                      (requested items + customer info)
//     -> Backend validates order               (real products, variants, stock)
//     -> Backend calculates authoritative price (never the browser's total)
//     -> Backend creates a pending order
//     -> Backend initializes payment
//     -> Frontend opens the payment interface
//     -> Payment provider processes payment
//     -> Backend verifies payment server-to-server
//     -> Order becomes paid
//
// SECURITY — the frontend is NEVER the authority for:
//   product prices, final totals, stock levels, payment status, order status.
// The browser may only send product IDs, quantities, selected variants, and
// customer/shipping information. The backend/database must independently
// determine every pric
// e, total, stock figure, and status transition. Treat all
// request bodies as untrusted input.
//
// This milestone stops before real payment processing: no database, no payment
// provider calls, no authentication, and no persisted orders.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const ordersRouter = require("./routes/orders");
const paymentsRouter = require("./routes/payments");
const productsRouter = require("./routes/products");

const app = express();
const port = Number(process.env.PORT) || 5000;

// CORS is limited to the local development origins that serve the static
// frontend. The frontend currently has no fetch() calls, so this only prepares
// the boundary; there is no permissive production configuration. Update
// CORS_ORIGINS (comma-separated) when the real deployed origin is known.
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5500",
];

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins =
  corsOrigins.length > 0 ? corsOrigins : DEFAULT_DEV_ORIGINS;

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, server-to-server, same-origin)
      // are not subject to browser CORS checks.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);

app.use(
  express.json({
    verify(req, _res, buffer) {
      // Paystack signs the exact request bytes. Keep those bytes only for its
      // webhook while leaving the parsed JSON behavior unchanged elsewhere.
      if (req.path === "/api/payments/webhook") {
        req.rawBody = Buffer.from(buffer);
      }
    },
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "HANIF'S STORE API is running",
  });
});

app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/products", productsRouter);

// Unknown API routes return JSON rather than Express's default HTML page.
app.use("/api", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Final error handler: always JSON, and never a stack trace or internal detail.
app.use((error, _req, res, _next) => {
  if (error && error.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`HANIF'S STORE API listening on port ${port}`);
  });
}

module.exports = app;
