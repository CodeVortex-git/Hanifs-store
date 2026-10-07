const prisma = require("./prisma");
const { DELIVERY_STATUS } = require("../constants/statuses");

const DELIVERY_FEES_KOBO = Object.freeze({ LAGOS: 150_000, OTHER_NIGERIAN_STATES: 350_000 });
const MAX_REASON_LENGTH = 500;
const MAX_PROVIDER_LENGTH = 100;
const MAX_REFERENCE_LENGTH = 255;

const NIGERIAN_STATES = new Set([
  "abia", "adamawa", "akwa ibom", "anambra", "bauchi", "bayelsa", "benue", "borno",
  "cross river", "delta", "ebonyi", "edo", "ekiti", "enugu", "gombe", "imo", "jigawa",
  "kaduna", "kano", "katsina", "kebbi", "kogi", "kwara", "lagos", "nasarawa", "niger",
  "ogun", "ondo", "osun", "oyo", "plateau", "rivers", "sokoto", "taraba", "yobe",
  "zamfara", "federal capital territory", "abuja", "fct",
]);

const LEGAL_TRANSITIONS = Object.freeze({
  [DELIVERY_STATUS.PENDING]: new Set([DELIVERY_STATUS.READY_FOR_DISPATCH]),
  [DELIVERY_STATUS.READY_FOR_DISPATCH]: new Set([DELIVERY_STATUS.OUT_FOR_DELIVERY]),
  [DELIVERY_STATUS.OUT_FOR_DELIVERY]: new Set([DELIVERY_STATUS.DELIVERED, DELIVERY_STATUS.DELIVERY_FAILED]),
});

class DeliveryServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "DeliveryServiceError";
    this.status = status;
  }
}

function parseOrderId(rawId) {
  if (typeof rawId !== "string" || !/^[A-Za-z0-9_-]+$/.test(rawId) || rawId.length > 128) {
    throw new DeliveryServiceError(400, "Enter a valid order ID.");
  }
  return rawId;
}

function calculateDeliveryFee(shipping = {}) {
  if (typeof shipping.country !== "string" || shipping.country.trim().toLowerCase() !== "nigeria") {
    throw new DeliveryServiceError(400, "Delivery is currently available for Nigerian addresses only.");
  }
  if (typeof shipping.state !== "string") throw new DeliveryServiceError(400, "Enter a valid Nigerian state.");
  const state = shipping.state.trim().toLowerCase().replace(/\s+state$/, "");
  if (!NIGERIAN_STATES.has(state)) throw new DeliveryServiceError(400, "Enter a valid Nigerian state.");
  return state === "lagos" ? DELIVERY_FEES_KOBO.LAGOS : DELIVERY_FEES_KOBO.OTHER_NIGERIAN_STATES;
}

function parseDeliveryQuote(query = {}) {
  const allowed = new Set(["state", "country"]);
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  if (unknown) throw new DeliveryServiceError(400, `Unsupported delivery quote field: ${unknown}.`);
  return { deliveryAmount: calculateDeliveryFee(query) };
}

function optionalText(value, field, maxLength) {
  if (value === null) return null;
  if (typeof value !== "string") throw new DeliveryServiceError(400, `The ${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new DeliveryServiceError(400, `The ${field} is too long.`);
  return trimmed || null;
}

function optionalDate(value, field) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim()) throw new DeliveryServiceError(400, `Enter a valid ${field}.`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new DeliveryServiceError(400, `Enter a valid ${field}.`);
  return parsed;
}

function validateDeliveryBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DeliveryServiceError(400, "Enter a valid delivery update.");
  }

  const allowed = new Set(["status", "provider", "trackingNumber", "reference", "estimatedDeliveryDate", "failedReason", "reason"]);
  const unknown = Object.keys(body).find((key) => !allowed.has(key));
  if (unknown) throw new DeliveryServiceError(400, `Unsupported delivery field: ${unknown}.`);
  if (Object.keys(body).length === 0) throw new DeliveryServiceError(400, "Provide at least one delivery update.");

  const result = {};
  if (Object.hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !Object.values(DELIVERY_STATUS).includes(body.status)) {
      throw new DeliveryServiceError(400, "Enter a valid delivery status.");
    }
    result.status = body.status;
  }
  if (Object.hasOwn(body, "provider")) result.provider = optionalText(body.provider, "provider", MAX_PROVIDER_LENGTH);
  if (Object.hasOwn(body, "trackingNumber")) result.trackingNumber = optionalText(body.trackingNumber, "tracking number", MAX_REFERENCE_LENGTH);
  if (Object.hasOwn(body, "reference")) result.reference = optionalText(body.reference, "delivery reference", MAX_REFERENCE_LENGTH);
  if (Object.hasOwn(body, "estimatedDeliveryDate")) {
    result.estimatedDeliveryDate = optionalDate(body.estimatedDeliveryDate, "estimated delivery date");
  }
  if (Object.hasOwn(body, "failedReason")) result.failedReason = optionalText(body.failedReason, "failure reason", MAX_REASON_LENGTH);
  if (Object.hasOwn(body, "reason")) result.reason = optionalText(body.reason, "reason", MAX_REASON_LENGTH);
  if (Object.keys(result).length === 1 && Object.hasOwn(result, "reason")) {
    throw new DeliveryServiceError(400, "A reason must accompany a delivery change.");
  }
  return result;
}

function isLegalTransition(currentStatus, nextStatus) {
  return currentStatus !== nextStatus && LEGAL_TRANSITIONS[currentStatus]?.has(nextStatus) === true;
}

const customerDeliverySelect = {
  id: true,
  status: true,
  provider: true,
  trackingNumber: true,
  reference: true,
  estimatedDeliveryDate: true,
  dispatchedAt: true,
  deliveredAt: true,
  failedReason: true,
  deliveryFee: true,
};

const adminDeliverySelect = {
  ...customerDeliverySelect,
  orderId: true,
  createdAt: true,
  updatedAt: true,
  statusHistory: {
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      previousStatus: true,
      newStatus: true,
      reason: true,
      createdAt: true,
      admin: { select: { id: true, displayName: true, email: true } },
    },
  },
};

async function getCustomerDelivery(userId, orderId) {
  const orderKey = parseOrderId(orderId);
  if (typeof userId !== "string" || !userId) throw new DeliveryServiceError(401, "Authentication is required.");
  const order = await prisma.order.findFirst({
    where: { id: orderKey, userId },
    select: { delivery: { select: customerDeliverySelect } },
  });
  if (!order?.delivery) throw new DeliveryServiceError(404, "Order not found.");
  return order.delivery;
}

async function getAdminDelivery(orderId) {
  const orderKey = parseOrderId(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderKey },
    select: { delivery: { select: adminDeliverySelect } },
  });
  if (!order) throw new DeliveryServiceError(404, "Order not found.");
  if (!order.delivery) throw new DeliveryServiceError(404, "Delivery information is not available for this order.");
  return order.delivery;
}

async function updateDelivery(orderId, body, adminId) {
  const orderKey = parseOrderId(orderId);
  if (typeof adminId !== "string" || !adminId) throw new DeliveryServiceError(401, "Administrator authentication is required.");
  const payload = validateDeliveryBody(body);

  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: orderKey },
      select: { delivery: { select: { id: true, status: true } } },
    });
    if (!order) throw new DeliveryServiceError(404, "Order not found.");
    if (!order.delivery) throw new DeliveryServiceError(404, "Delivery information is not available for this order.");

    const deliveryId = order.delivery.id;
    const previousStatus = order.delivery.status;
    const nextStatus = payload.status ?? previousStatus;
    const statusChanged = payload.status !== undefined;
    if (statusChanged && !isLegalTransition(previousStatus, nextStatus)) {
      throw new DeliveryServiceError(409, "This delivery status change is not allowed.");
    }
    if (nextStatus === DELIVERY_STATUS.DELIVERY_FAILED && !payload.failedReason && !payload.reason) {
      throw new DeliveryServiceError(400, "A reason is required when delivery fails.");
    }
    if (payload.failedReason !== undefined && nextStatus !== DELIVERY_STATUS.DELIVERY_FAILED) {
      throw new DeliveryServiceError(400, "A failure reason is only valid for a failed delivery.");
    }

    const data = {};
    for (const field of ["provider", "trackingNumber", "reference", "estimatedDeliveryDate", "failedReason"]) {
      if (payload[field] !== undefined) data[field] = payload[field];
    }
    if (statusChanged) {
      data.status = nextStatus;
      if (nextStatus === DELIVERY_STATUS.DELIVERY_FAILED) {
        data.failedReason = payload.failedReason ?? payload.reason;
      }
      if (nextStatus === DELIVERY_STATUS.OUT_FOR_DELIVERY) data.dispatchedAt = new Date();
      if (nextStatus === DELIVERY_STATUS.DELIVERED) {
        data.deliveredAt = new Date();
        data.failedReason = null;
      }
      if (nextStatus !== DELIVERY_STATUS.DELIVERY_FAILED && nextStatus !== DELIVERY_STATUS.DELIVERED) {
        data.failedReason = null;
      }
    }

    const updatedCount = await transaction.delivery.updateMany({
      where: { id: deliveryId, status: previousStatus },
      data,
    });
    if (updatedCount.count !== 1) {
      throw new DeliveryServiceError(409, "Delivery changed concurrently. Reload and try again.");
    }

    if (statusChanged) {
      await transaction.deliveryStatusHistory.create({
        data: {
          deliveryId,
          adminId,
          previousStatus,
          newStatus: nextStatus,
          reason: payload.reason ?? payload.failedReason ?? null,
        },
      });
    }

    const updated = await transaction.delivery.findUnique({
      where: { id: deliveryId },
      select: customerDeliverySelect,
    });
    return { delivery: updated };
  });
}

module.exports = {
  DELIVERY_FEES_KOBO,
  DeliveryServiceError,
  calculateDeliveryFee,
  getAdminDelivery,
  getCustomerDelivery,
  isLegalTransition,
  parseDeliveryQuote,
  updateDelivery,
  validateDeliveryBody,
};
