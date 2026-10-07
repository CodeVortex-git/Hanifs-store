const prisma = require("./prisma");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/statuses");
const { LOW_STOCK_THRESHOLD } = require("../constants/inventory");

async function getDashboardSummary() {
  const [totalOrders, pendingOrders, paidOrders, revenue, customers, activeProducts, lowStockVariants] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { orderStatus: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAYMENT_PENDING] } } }),
    prisma.order.count({ where: { orderStatus: ORDER_STATUS.PAID, paymentStatus: PAYMENT_STATUS.SUCCESS } }),
    prisma.order.aggregate({
      where: { orderStatus: ORDER_STATUS.PAID, paymentStatus: PAYMENT_STATUS.SUCCESS },
      _sum: { totalAmount: true },
    }),
    prisma.user.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.productVariant.count({
      where: { active: true, product: { is: { active: true } }, stock: { lte: LOW_STOCK_THRESHOLD } },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    currency: "NGN",
    orders: { total: totalOrders, pending: pendingOrders, paid: paidOrders },
    revenue: { successfulKobo: revenue._sum.totalAmount || 0 },
    customers: { total: customers },
    products: { active: activeProducts },
    inventory: { lowStockVariants, threshold: LOW_STOCK_THRESHOLD },
  };
}

module.exports = { LOW_STOCK_THRESHOLD, getDashboardSummary };
