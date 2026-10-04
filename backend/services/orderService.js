const prisma = require("./prisma");
const inventoryService = require("./inventoryService");
const { ORDER_STATUS, PAYMENT_STATUS } = require("../constants/statuses");

const MAX_DATABASE_INT = 2_147_483_647;

class OrderServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "OrderServiceError";
    this.status = status;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new OrderServiceError(400, `Enter a valid ${label.toLowerCase()}.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new OrderServiceError(400, `Enter a valid ${label.toLowerCase()}.`);
  }
  return normalized;
}

function validateOrderRequest(body) {
  if (!isRecord(body) || !isRecord(body.customer) || !isRecord(body.shipping)) {
    throw new OrderServiceError(400, "Enter valid customer and shipping details.");
  }

  const email = requiredText(body.customer.email, "email address", 255);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OrderServiceError(400, "Enter a valid email address.");
  }

  const customer = {
    email,
    firstName: requiredText(body.customer.firstName, "first name", 100),
    lastName: requiredText(body.customer.lastName, "last name", 100),
    phone: requiredText(body.customer.phone, "phone number", 20),
  };
  if (!/^[0-9+()\s-]{7,20}$/.test(customer.phone)) {
    throw new OrderServiceError(400, "Enter a valid phone number.");
  }

  const shipping = {
    address: requiredText(body.shipping.address, "street address", 5000),
    city: requiredText(body.shipping.city, "city", 100),
    state: requiredText(body.shipping.state, "state", 100),
    country: requiredText(body.shipping.country, "country", 100),
  };

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    throw new OrderServiceError(400, "Your order must contain between 1 and 50 items.");
  }

  // Aggregate repeated variant IDs so a repeated line cannot bypass the stock check.
  const quantities = new Map();
  for (const item of body.items) {
    if (!isRecord(item)) {
      throw new OrderServiceError(400, "Your order contains an invalid item.");
    }
    const variantId = item.productVariantId;
    const quantity = item.quantity;
    if (!Number.isSafeInteger(variantId) || variantId < 1) {
      throw new OrderServiceError(400, "Your order contains an invalid item.");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new OrderServiceError(400, "Each item quantity must be a positive whole number.");
    }
    const combinedQuantity = (quantities.get(variantId) || 0) + quantity;
    if (!Number.isSafeInteger(combinedQuantity)) {
      throw new OrderServiceError(400, "The requested quantity is invalid.");
    }
    quantities.set(variantId, combinedQuantity);
  }

  return { customer, shipping, quantities };
}

async function createOrder(body) {
  const { customer, shipping, quantities } = validateOrderRequest(body);
  // Reclaim expired holds lazily; this project has no background worker.
  await inventoryService.releaseExpiredReservations();
  const variantIds = [...quantities.keys()];

  return prisma.$transaction(async (transaction) => {
    const variants = await transaction.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        size: true,
        color: true,
        price: true,
        stock: true,
        active: true,
        product: { select: { name: true, active: true } },
      },
    });

    const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
    for (const variantId of variantIds) {
      const variant = variantsById.get(variantId);
      if (!variant || !variant.active || !variant.product || !variant.product.active) {
        throw new OrderServiceError(404, "One or more selected items are unavailable. Refresh your bag and try again.");
      }
      if (quantities.get(variantId) > variant.stock) {
        throw new OrderServiceError(409, "There is not enough stock for one or more selected items.");
      }
    }

    const items = variantIds.map((variantId) => {
      const variant = variantsById.get(variantId);
      const quantity = quantities.get(variantId);
      const lineTotal = variant.price * quantity;
      if (!Number.isSafeInteger(lineTotal) || lineTotal > MAX_DATABASE_INT) {
        throw new OrderServiceError(400, "The order amount is too large to process.");
      }
      return {
        productVariantId: variant.id,
        productName: variant.product.name,
        selectedSize: variant.size,
        selectedColor: variant.color,
        quantity,
        unitPrice: variant.price,
        lineTotal,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal > MAX_DATABASE_INT) {
      throw new OrderServiceError(400, "The order amount is too large to process.");
    }

    // Delivery pricing is intentionally deferred to Milestone 37.
    const deliveryAmount = 0;
    const totalAmount = subtotal + deliveryAmount;

    const created = await transaction.order.create({
      data: {
        customerEmail: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        shippingAddress: shipping.address,
        city: shipping.city,
        state: shipping.state,
        country: shipping.country,
        subtotal,
        deliveryAmount,
        totalAmount,
        orderStatus: ORDER_STATUS.PENDING,
        paymentStatus: PAYMENT_STATUS.PENDING,
        items: { create: items },
      },
      select: {
        id: true,
        orderStatus: true,
        paymentStatus: true,
        subtotal: true,
        deliveryAmount: true,
        totalAmount: true,
        createdAt: true,
        items: {
          select: {
            productVariantId: true,
            productName: true,
            selectedSize: true,
            selectedColor: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });

    return created;
  });
}

module.exports = { createOrder, OrderServiceError };
