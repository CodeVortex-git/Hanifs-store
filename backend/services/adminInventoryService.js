const prisma = require("./prisma");
const { LOW_STOCK_THRESHOLD } = require("../constants/inventory");

const MAX_INT = 2_147_483_647;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1_000_000;

class AdminInventoryError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AdminInventoryError";
    this.status = status;
  }
}

function parsePositiveInteger(value, label, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AdminInventoryError(400, `Enter a valid ${label}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new AdminInventoryError(400, `Enter a valid ${label}.`);
  return parsed;
}

function parseVariantId(value) {
  return parsePositiveInteger(value, "variant ID");
}

function buildInventoryQuery(query = {}) {
  const allowed = new Set(["page", "limit", "q", "productId", "status", "lowStock"]);
  const unknown = Object.keys(query).find((key) => !allowed.has(key));
  if (unknown) throw new AdminInventoryError(400, `Unsupported inventory filter: ${unknown}.`);

  const page = parsePositiveInteger(query.page, "page number", 1, 100_001);
  const limit = parsePositiveInteger(query.limit, "page size", DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_OFFSET) throw new AdminInventoryError(400, "The requested page is too large.");

  let search = "";
  if (query.q !== undefined) {
    if (typeof query.q !== "string" || query.q.trim().length > 100) throw new AdminInventoryError(400, "Enter a valid search query.");
    search = query.q.trim();
  }
  const status = query.status ?? "all";
  if (!["all", "active", "inactive"].includes(status)) throw new AdminInventoryError(400, "The status filter must be all, active, or inactive.");
  let lowStock;
  if (query.lowStock !== undefined) {
    if (!["true", "false"].includes(query.lowStock)) throw new AdminInventoryError(400, "The low-stock filter must be true or false.");
    lowStock = query.lowStock === "true";
  }
  const productId = query.productId === undefined ? undefined : parsePositiveInteger(query.productId, "product ID");

  const filters = [];
  if (status === "active") filters.push({ active: true, product: { is: { active: true } } });
  if (status === "inactive") filters.push({ OR: [{ active: false }, { product: { is: { active: false } } }] });
  if (lowStock === true) filters.push({ active: true, product: { is: { active: true } }, stock: { lte: LOW_STOCK_THRESHOLD } });
  if (lowStock === false) filters.push({ OR: [{ active: false }, { product: { is: { active: false } } }, { stock: { gt: LOW_STOCK_THRESHOLD } }] });
  if (productId !== undefined) filters.push({ productId });
  if (search) {
    filters.push({
      OR: [
        { size: { contains: search, mode: "insensitive" } },
        { color: { contains: search, mode: "insensitive" } },
        { product: { is: { name: { contains: search, mode: "insensitive" } } } },
        { product: { is: { category: { contains: search, mode: "insensitive" } } } },
        { product: { is: { gender: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }
  return { page, limit, skip, where: filters.length ? { AND: filters } : {} };
}

const inventorySelect = {
  id: true,
  productId: true,
  size: true,
  color: true,
  price: true,
  stock: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true, category: true, active: true } },
};

function safeInventoryVariant(variant, reservations = emptyReservationSummary()) {
  const isActiveForSale = variant.active && variant.product.active;
  const available = isActiveForSale ? variant.stock : 0;
  return {
    id: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    category: variant.product.category,
    productActive: variant.product.active,
    size: variant.size,
    color: variant.color,
    price: variant.price,
    stock: variant.stock,
    availableStock: available,
    variantActive: variant.active,
    isLowStock: isActiveForSale && available <= LOW_STOCK_THRESHOLD,
    ...reservations,
  };
}

function emptyReservationSummary() {
  return {
    reservedStock: 0,
    activeReservedStock: 0,
    expiredReservationStock: 0,
    reservationCount: 0,
    nextReservationExpiresAt: null,
    reconciliationRequired: false,
    reconciliationCount: 0,
  };
}

async function getReservationSummaries(variantIds, client = prisma, now = new Date()) {
  const summaries = new Map(variantIds.map((id) => [id, emptyReservationSummary()]));
  if (!variantIds.length) return summaries;
  const orders = await client.order.findMany({
    where: {
      OR: [
        { inventoryReservationStatus: "reserved" },
        { paymentReconciliationRequired: true },
      ],
      items: { some: { productVariantId: { in: variantIds } } },
    },
    select: {
      inventoryReservationStatus: true,
      inventoryReservationExpiresAt: true,
      paymentReconciliationRequired: true,
      items: {
        where: { productVariantId: { in: variantIds } },
        select: { productVariantId: true, quantity: true },
      },
    },
  });

  for (const order of orders) {
    const expiresAt = order.inventoryReservationExpiresAt;
    const expired = expiresAt instanceof Date && expiresAt <= now;
    for (const item of order.items) {
      const summary = summaries.get(item.productVariantId);
      if (!summary) continue;
      if (order.inventoryReservationStatus === "reserved") {
        summary.reservedStock += item.quantity;
        summary.reservationCount += 1;
        if (expired) summary.expiredReservationStock += item.quantity;
        else {
          summary.activeReservedStock += item.quantity;
          if (expiresAt && (!summary.nextReservationExpiresAt || expiresAt < summary.nextReservationExpiresAt)) {
            summary.nextReservationExpiresAt = expiresAt;
          }
        }
      }
      if (order.paymentReconciliationRequired) {
        summary.reconciliationRequired = true;
        summary.reconciliationCount += 1;
      }
    }
  }
  return summaries;
}

async function listInventory(query = {}) {
  const { page, limit, skip, where } = buildInventoryQuery(query);
  const [variants, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      orderBy: [{ product: { name: "asc" } }, { size: "asc" }, { color: "asc" }, { id: "asc" }],
      skip,
      take: limit,
      select: inventorySelect,
    }),
    prisma.productVariant.count({ where }),
  ]);
  const summaries = await getReservationSummaries(variants.map((variant) => variant.id));
  return {
    inventory: variants.map((variant) => safeInventoryVariant(variant, summaries.get(variant.id))),
    pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  };
}

async function getInventoryItem(rawId) {
  const id = parseVariantId(rawId);
  const variant = await prisma.productVariant.findUnique({ where: { id }, select: inventorySelect });
  if (!variant) throw new AdminInventoryError(404, "Inventory item not found.");
  const [summaries, adjustments] = await Promise.all([
    getReservationSummaries([id]),
    prisma.inventoryAdjustment.findMany({
      where: { productVariantId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true, delta: true, previousStock: true, resultingStock: true, reason: true, createdAt: true,
        admin: { select: { id: true, displayName: true } },
      },
    }),
  ]);
  return {
    inventory: safeInventoryVariant(variant, summaries.get(id)),
    adjustments: adjustments.map((adjustment) => ({
      id: adjustment.id,
      delta: adjustment.delta,
      previousStock: adjustment.previousStock,
      resultingStock: adjustment.resultingStock,
      reason: adjustment.reason,
      createdAt: adjustment.createdAt,
      admin: adjustment.admin,
    })),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  };
}

function validateAdjustment(body, adminId) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminInventoryError(400, "Enter a valid inventory adjustment.");
  const unknown = Object.keys(body).find((field) => !["delta", "reason"].includes(field));
  if (unknown) throw new AdminInventoryError(400, `Unsupported adjustment field: ${unknown}.`);
  if (!Number.isSafeInteger(body.delta) || body.delta === 0 || Math.abs(body.delta) > MAX_INT) {
    throw new AdminInventoryError(400, "Adjustment delta must be a nonzero whole number within the supported range.");
  }
  if (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 500) {
    throw new AdminInventoryError(400, "Enter a reason between 3 and 500 characters.");
  }
  if (typeof adminId !== "string" || !adminId) throw new AdminInventoryError(401, "Administrator authentication is required.");
  return { delta: body.delta, reason: body.reason.trim() };
}

async function getReservedQuantityForVariant(transaction, variantId) {
  const orders = await transaction.order.findMany({
    where: {
      inventoryReservationStatus: "reserved",
      items: { some: { productVariantId: { in: [variantId] } } },
    },
    select: {
      items: {
        where: { productVariantId: { in: [variantId] } },
        select: { quantity: true },
      },
    },
  });

  return orders.reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);
}

async function adjustInventory(rawId, body, adminId) {
  const variantId = parseVariantId(rawId);
  const { delta, reason } = validateAdjustment(body, adminId);
  let adjustment;
  await prisma.$transaction(async (transaction) => {
    const variant = await transaction.productVariant.findUnique({
      where: { id: variantId },
      select: { id: true, stock: true },
    });
    if (!variant) throw new AdminInventoryError(404, "Inventory item not found.");

    const reservedQuantity = await getReservedQuantityForVariant(transaction, variantId);
    const resultingStock = variant.stock + delta;
    if (!Number.isSafeInteger(resultingStock) || resultingStock < 0 || resultingStock > MAX_INT) {
      throw new AdminInventoryError(409, "The adjustment exceeds available stock or the supported stock limit.");
    }
    if (delta < 0 && resultingStock < reservedQuantity) {
      throw new AdminInventoryError(409, "This adjustment would remove inventory that is already reserved.");
    }

    const updated = await transaction.productVariant.updateMany({
      where: { id: variantId, stock: variant.stock },
      data: { stock: resultingStock },
    });
    if (updated.count !== 1) throw new AdminInventoryError(409, "Inventory changed while this adjustment was being applied. Reload and try again.");
    adjustment = await transaction.inventoryAdjustment.create({
      data: { productVariantId: variantId, adminId, delta, previousStock: variant.stock, resultingStock, reason },
      select: { id: true, productVariantId: true, adminId: true, delta: true, previousStock: true, resultingStock: true, reason: true, createdAt: true },
    });
  });
  return { adjustment, ...(await getInventoryItem(String(variantId))) };
}

module.exports = {
  AdminInventoryError,
  LOW_STOCK_THRESHOLD,
  adjustInventory,
  buildInventoryQuery,
  getInventoryItem,
  listInventory,
  parseVariantId,
  validateAdjustment,
};
