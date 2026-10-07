const prisma = require("./prisma");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/statuses");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_INT = 2_147_483_647;
const MAX_REASON_LENGTH = 500;

const ALLOWED_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PAYMENT_PENDING,
  ORDER_STATUS.PAID,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
]);

const LEGAL_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PAID]: new Set([ORDER_STATUS.PROCESSING]),
  [ORDER_STATUS.PROCESSING]: new Set([ORDER_STATUS.SHIPPED]),
  [ORDER_STATUS.SHIPPED]: new Set([ORDER_STATUS.DELIVERED]),
});

class AdminOrdersError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AdminOrdersError";
    this.status = status;
  }
}

function parsePositiveInteger(value, label, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AdminOrdersError(400, `Enter a valid ${label}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new AdminOrdersError(400, `Enter a valid ${label}.`);
  return parsed;
}

function parseOrderId(rawId) {
  if (typeof rawId !== "string" || !/^[A-Za-z0-9_-]+$/.test(rawId) || rawId.length > 128) {
    throw new AdminOrdersError(400, "Enter a valid order ID.");
  }
  return rawId;
}

function parseDateFilter(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) throw new AdminOrdersError(400, `Enter a valid ${label}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AdminOrdersError(400, `Enter a valid ${label}.`);
  const earliest = new Date("2000-01-01T00:00:00.000Z");
  const latest = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  if (parsed < earliest || parsed > latest) throw new AdminOrdersError(400, `Enter a valid ${label}.`);
  return parsed;
}

function parseOrderFilterQuery(query = {}) {
  const allowed = new Set(["page", "limit", "q", "status", "paymentStatus", "from", "to"]);
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  if (unknown) throw new AdminOrdersError(400, `Unsupported order filter: ${unknown}.`);

  const page = parsePositiveInteger(query.page, "page number", 1, 100_001);
  const limit = parsePositiveInteger(query.limit, "page size", DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_INT) {
    throw new AdminOrdersError(400, "The requested page is too large.");
  }

  let search = "";
  if (query.q !== undefined) {
    if (typeof query.q !== "string") throw new AdminOrdersError(400, "Enter a valid search query.");
    search = query.q.trim();
    if (search.length > 255) throw new AdminOrdersError(400, "Enter a valid search query.");
  }

  let orderStatus;
  if (query.status !== undefined && query.status !== "all") {
    if (typeof query.status !== "string" || !ALLOWED_STATUSES.has(query.status)) {
      throw new AdminOrdersError(400, "The order status filter is invalid.");
    }
    orderStatus = query.status;
  }

  let paymentStatus;
  if (query.paymentStatus !== undefined && query.paymentStatus !== "all") {
    if (typeof query.paymentStatus !== "string" || !Object.values(PAYMENT_STATUS).includes(query.paymentStatus)) {
      throw new AdminOrdersError(400, "The payment status filter is invalid.");
    }
    paymentStatus = query.paymentStatus;
  }

  const from = parseDateFilter(query.from, "start date");
  const to = parseDateFilter(query.to, "end date");
  if (from && to && from > to) throw new AdminOrdersError(400, "The start date must be before the end date.");

  const where = {};
  if (orderStatus) where.orderStatus = orderStatus;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  return { page, limit, skip, where };
}

const listSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  customerEmail: true,
  firstName: true,
  lastName: true,
  totalAmount: true,
  orderStatus: true,
  paymentStatus: true,
  inventoryReservationStatus: true,
  paymentReconciliationRequired: true,
};

function safeOrderList(order) {
  return {
    id: order.id,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: {
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.customerEmail,
    },
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    inventoryReservationStatus: order.inventoryReservationStatus,
    paymentReconciliationRequired: order.paymentReconciliationRequired,
  };
}

function sanitizeReason(reason) {
  if (reason === undefined) return null;
  if (typeof reason !== "string") throw new AdminOrdersError(400, "The reason must be a string.");
  const trimmed = reason.trim();
  if (trimmed.length > MAX_REASON_LENGTH) throw new AdminOrdersError(400, "The reason is too long.");
  return trimmed || null;
}

function validateStatusUpdate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminOrdersError(400, "Enter a valid order update.");
  const allowed = new Set(["orderStatus", "reason"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) throw new AdminOrdersError(400, `Unsupported order field: ${unknown}.`);
  if (typeof body.orderStatus !== "string" || !ALLOWED_STATUSES.has(body.orderStatus)) {
    throw new AdminOrdersError(400, "Enter a valid fulfillment status.");
  }
  const reason = sanitizeReason(body.reason);
  return { orderStatus: body.orderStatus, reason };
}

function isLegalTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return false;
  return LEGAL_TRANSITIONS[currentStatus]?.has(nextStatus) === true;
}

async function listOrders(query = {}) {
  const { page, limit, skip, where } = parseOrderFilterQuery(query);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip,
      take: limit,
      select: listSelect,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(safeOrderList),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

async function getOrder(rawId) {
  const orderId = parseOrderId(rawId);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      orderStatus: true,
      paymentStatus: true,
      paymentReference: true,
      paymentReconciliationRequired: true,
      inventoryReservationStatus: true,
      inventoryReservationExpiresAt: true,
      subtotal: true,
      deliveryAmount: true,
      totalAmount: true,
      firstName: true,
      lastName: true,
      customerEmail: true,
      phone: true,
      shippingAddress: true,
      city: true,
      state: true,
      country: true,
      items: {
        select: {
          productName: true,
          selectedSize: true,
          selectedColor: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
      statusHistory: {
        orderBy: [{ createdAt: "desc" }],
        take: 25,
        select: {
          id: true,
          previousStatus: true,
          newStatus: true,
          reason: true,
          createdAt: true,
          admin: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
  });

  if (!order) throw new AdminOrdersError(404, "Order not found.");

  return {
    order: {
      id: order.id,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference,
      paymentReconciliationRequired: order.paymentReconciliationRequired,
      inventoryReservationStatus: order.inventoryReservationStatus,
      inventoryReservationExpiresAt: order.inventoryReservationExpiresAt,
      subtotal: order.subtotal,
      deliveryAmount: order.deliveryAmount,
      totalAmount: order.totalAmount,
      customer: {
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.customerEmail,
        phone: order.phone,
      },
      shipping: {
        shippingAddress: order.shippingAddress,
        city: order.city,
        state: order.state,
        country: order.country,
      },
      items: order.items,
      statusHistory: order.statusHistory.map((entry) => ({
        id: entry.id,
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        reason: entry.reason,
        createdAt: entry.createdAt,
        admin: entry.admin ? { id: entry.admin.id, displayName: entry.admin.displayName, email: entry.admin.email } : null,
      })),
    },
  };
}

async function updateOrderStatus(orderId, body, adminId) {
  const orderKey = parseOrderId(orderId);
  if (typeof adminId !== "string" || !adminId) throw new AdminOrdersError(401, "Administrator authentication is required.");
  const { orderStatus: targetStatus, reason } = validateStatusUpdate(body);

  const result = await prisma.$transaction(async (transaction) => {
    const currentOrder = await transaction.order.findUnique({
      where: { id: orderKey },
      select: {
        id: true,
        orderStatus: true,
        paymentStatus: true,
        paymentReconciliationRequired: true,
      },
    });

    if (!currentOrder) throw new AdminOrdersError(404, "Order not found.");
    if (currentOrder.orderStatus === targetStatus) {
      throw new AdminOrdersError(409, "This order already has the requested fulfillment status.");
    }
    if (!isLegalTransition(currentOrder.orderStatus, targetStatus)) {
      throw new AdminOrdersError(409, "This fulfillment status change is not allowed.");
    }
    if (currentOrder.paymentStatus !== PAYMENT_STATUS.SUCCESS) {
      throw new AdminOrdersError(409, "Only paid orders can advance fulfillment status.");
    }
    if (currentOrder.paymentReconciliationRequired) {
      throw new AdminOrdersError(409, "This order needs payment reconciliation before fulfillment can continue.");
    }

    const update = await transaction.order.updateMany({
      where: {
        id: orderKey,
        orderStatus: currentOrder.orderStatus,
        paymentStatus: PAYMENT_STATUS.SUCCESS,
        paymentReconciliationRequired: false,
      },
      data: { orderStatus: targetStatus },
    });
    if (update.count !== 1) {
      throw new AdminOrdersError(409, "The fulfillment status could not be updated. Please reload and try again.");
    }

    const history = await transaction.orderStatusHistory.create({
      data: {
        orderId: orderKey,
        adminId,
        previousStatus: currentOrder.orderStatus,
        newStatus: targetStatus,
        reason,
      },
      select: {
        id: true,
        orderId: true,
        adminId: true,
        previousStatus: true,
        newStatus: true,
        reason: true,
        createdAt: true,
      },
    });

    const updated = await transaction.order.findUnique({
      where: { id: orderKey },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        orderStatus: true,
        paymentStatus: true,
        paymentReference: true,
        paymentReconciliationRequired: true,
        inventoryReservationStatus: true,
        inventoryReservationExpiresAt: true,
        subtotal: true,
        deliveryAmount: true,
        totalAmount: true,
        firstName: true,
        lastName: true,
        customerEmail: true,
        phone: true,
        shippingAddress: true,
        city: true,
        state: true,
        country: true,
        items: {
          select: {
            productName: true,
            selectedSize: true,
            selectedColor: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    return { order: updated, history };
  });

  return { order: result.order, history: result.history };
}

module.exports = {
  AdminOrdersError,
  getOrder,
  listOrders,
  parseOrderFilterQuery,
  updateOrderStatus,
  validateStatusUpdate,
  isLegalTransition,
};
