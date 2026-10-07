const { getDashboardSummary } = require("../services/adminDashboardService");

async function getDashboard(_req, res) {
  res.set("Cache-Control", "private, no-store");
  try {
    const dashboard = await getDashboardSummary();
    res.status(200).json({ success: true, dashboard });
  } catch (error) {
    console.error("Admin dashboard query failed:", error?.message || "Unknown error");
    res.status(500).json({ success: false, message: "The dashboard could not be loaded. Please try again." });
  }
}

module.exports = { getDashboard };
