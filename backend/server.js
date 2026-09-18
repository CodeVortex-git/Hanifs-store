require("dotenv").config();

const express = require("express");
const ordersRouter = require("./routes/orders");
const paymentsRouter = require("./routes/payments");

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "HANIF'S STORE API is running",
  });
});

app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);

app.use((error, _req, res, _next) => {
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
