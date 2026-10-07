const prisma = require("./prisma");

const MAX_INT = 2_147_483_647;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1_000_000;
const PRODUCT_FIELDS = new Set(["name", "description", "category", "gender", "basePrice", "image", "imageAlt", "featured", "newArrival", "active"]);
const VARIANT_FIELDS = new Set(["size", "color", "price", "active"]);

class AdminProductError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AdminProductError";
    this.status = status;
  }
}

function requireRecord(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminProductError(400, message);
}

function rejectUnknownFields(body, allowed, label) {
  const unknown = Object.keys(body).filter((field) => !allowed.has(field));
  if (unknown.length) throw new AdminProductError(400, `Unsupported ${label} field: ${unknown[0]}.`);
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string") throw new AdminProductError(400, `Enter a valid ${field}.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new AdminProductError(400, `Enter a valid ${field}.`);
  return normalized;
}

function validatePrice(value, field = "price") {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_INT) {
    throw new AdminProductError(400, `${field} must be a positive integer number of kobo within the supported range.`);
  }
  return value;
}

function validateImageUrl(value) {
  const urlText = requiredText(value, "image URL", 500);
  let parsed;
  try { parsed = new URL(urlText); } catch { throw new AdminProductError(400, "Enter a valid image URL."); }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new AdminProductError(400, "Image URLs must use http or https and cannot contain credentials.");
  }
  return parsed.toString();
}

function validateBoolean(value, field) {
  if (typeof value !== "boolean") throw new AdminProductError(400, `${field} must be true or false.`);
  return value;
}

function validateProductFields(body, { creating = false } = {}) {
  requireRecord(body, "Enter valid product details.");
  rejectUnknownFields(body, PRODUCT_FIELDS, "product");
  if (!creating && Object.keys(body).length === 0) throw new AdminProductError(400, "Provide at least one product field to update.");
  const data = {};
  const definitions = {
    name: (value) => requiredText(value, "product name", 255),
    description: (value) => requiredText(value, "description", 20_000),
    category: (value) => requiredText(value, "category", 100),
    gender: (value) => requiredText(value, "gender", 20),
    basePrice: (value) => validatePrice(value, "basePrice"),
    image: validateImageUrl,
    imageAlt: (value) => requiredText(value, "image alt text", 255),
    featured: (value) => validateBoolean(value, "featured"),
    newArrival: (value) => validateBoolean(value, "newArrival"),
    active: (value) => validateBoolean(value, "active"),
  };
  for (const [field, validate] of Object.entries(definitions)) {
    if (Object.hasOwn(body, field)) data[field === "image" ? "imageUrl" : field] = validate(body[field]);
  }
  if (creating) {
    const required = ["name", "description", "category", "gender", "basePrice", "image", "imageAlt"];
    const missing = required.find((field) => !Object.hasOwn(body, field));
    if (missing) throw new AdminProductError(400, `The ${missing} field is required.`);
    data.featured ??= false;
    data.newArrival ??= false;
    data.active ??= true;
  }
  return data;
}

function validateVariantFields(body, { creating = false } = {}) {
  requireRecord(body, "Enter valid variant details.");
  rejectUnknownFields(body, VARIANT_FIELDS, "variant");
  if (!creating && Object.keys(body).length === 0) throw new AdminProductError(400, "Provide at least one variant field to update.");
  const data = {};
  if (Object.hasOwn(body, "size")) data.size = requiredText(body.size, "size", 20);
  if (Object.hasOwn(body, "color")) data.color = requiredText(body.color, "color", 50);
  if (Object.hasOwn(body, "price")) data.price = validatePrice(body.price, "price");
  if (Object.hasOwn(body, "active")) data.active = validateBoolean(body.active, "active");
  if (creating) {
    for (const field of ["size", "color", "price"]) {
      if (!Object.hasOwn(body, field)) throw new AdminProductError(400, `The ${field} field is required.`);
    }
    data.active ??= true;
  }
  return data;
}

function validateInitialVariants(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new AdminProductError(400, "Variants must be a list of no more than 100 entries.");
  const variants = value.map((variant) => validateVariantFields(variant, { creating: true }));
  const seen = new Set();
  for (const variant of variants) {
    const key = `${variant.size.toLocaleLowerCase("en")}\u0000${variant.color.toLocaleLowerCase("en")}`;
    if (seen.has(key)) throw new AdminProductError(409, "A variant with this size and color already exists for the product.");
    seen.add(key);
  }
  return variants;
}

function parsePathId(value, label) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AdminProductError(400, `Enter a valid ${label} ID.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AdminProductError(400, `Enter a valid ${label} ID.`);
  return parsed;
}

function parsePageValue(value, fallback, label, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AdminProductError(400, `Enter a valid ${label}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new AdminProductError(400, `Enter a valid ${label}.`);
  return parsed;
}

function buildListQuery(query = {}) {
  const allowed = new Set(["page", "limit", "q", "active"]);
  rejectUnknownFields(query, allowed, "query");
  const page = parsePageValue(query.page, 1, "page number", 100_001);
  const limit = parsePageValue(query.limit, DEFAULT_LIMIT, "page size", MAX_LIMIT);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > MAX_OFFSET) throw new AdminProductError(400, "The requested page is too large.");
  let search = "";
  if (query.q !== undefined) {
    if (typeof query.q !== "string" || query.q.trim().length > 100) throw new AdminProductError(400, "Enter a valid search query.");
    search = query.q.trim();
  }
  let active;
  if (query.active !== undefined && query.active !== "all") {
    if (query.active !== "true" && query.active !== "false") throw new AdminProductError(400, "The active filter must be true, false, or all.");
    active = query.active === "true";
  }
  const where = {};
  if (active !== undefined) where.active = active;
  if (search) where.OR = ["name", "category", "gender"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } }));
  return { page, limit, skip, where };
}

const productSelect = {
  id: true, name: true, description: true, category: true, gender: true,
  basePrice: true, imageUrl: true, imageAlt: true, featured: true,
  newArrival: true, active: true, createdAt: true, updatedAt: true,
  variants: {
    orderBy: [{ size: "asc" }, { color: "asc" }, { id: "asc" }],
    select: { id: true, productId: true, size: true, color: true, price: true, stock: true, active: true, createdAt: true, updatedAt: true },
  },
};

function safeVariant(variant) {
  return { id: variant.id, productId: variant.productId, size: variant.size, color: variant.color, price: variant.price, stock: variant.stock, active: variant.active, createdAt: variant.createdAt, updatedAt: variant.updatedAt };
}

function safeProduct(product) {
  return {
    id: product.id, name: product.name, description: product.description, category: product.category,
    gender: product.gender, basePrice: product.basePrice, image: product.imageUrl, imageAlt: product.imageAlt,
    featured: product.featured, newArrival: product.newArrival, active: product.active,
    createdAt: product.createdAt, updatedAt: product.updatedAt,
    variants: (product.variants || []).map(safeVariant),
  };
}

function isUniqueViolation(error) { return error?.code === "P2002"; }

async function listProducts(query) {
  const { page, limit, skip, where } = buildListQuery(query);
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip, take: limit, select: productSelect }),
    prisma.product.count({ where }),
  ]);
  return { products: products.map(safeProduct), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getProduct(rawId) {
  const id = parsePathId(rawId, "product");
  const product = await prisma.product.findUnique({ where: { id }, select: productSelect });
  if (!product) throw new AdminProductError(404, "Product not found.");
  return safeProduct(product);
}

async function createProduct(body) {
  requireRecord(body, "Enter valid product details.");
  const productBody = { ...body };
  const rawVariants = productBody.variants;
  delete productBody.variants;
  const data = validateProductFields(productBody, { creating: true });
  const variants = validateInitialVariants(rawVariants);
  try {
    const product = await prisma.product.create({
      data: {
        ...data,
        ...(variants.length ? { variants: { create: variants.map((variant) => ({ ...variant, stock: 0 })) } } : {}),
      },
      select: productSelect,
    });
    return safeProduct(product);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminProductError(409, "One or more variants already exist for this product.");
    throw error;
  }
}

async function updateProduct(rawId, body) {
  const id = parsePathId(rawId, "product");
  const data = validateProductFields(body);
  try {
    const product = await prisma.product.update({ where: { id }, data, select: productSelect });
    return safeProduct(product);
  } catch (error) {
    if (error?.code === "P2025") throw new AdminProductError(404, "Product not found.");
    throw error;
  }
}

async function createVariant(rawProductId, body) {
  const productId = parsePathId(rawProductId, "product");
  const data = validateVariantFields(body, { creating: true });
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new AdminProductError(404, "Product not found.");
  try {
    const variant = await prisma.productVariant.create({
      data: { ...data, productId, stock: 0 },
      select: { id: true, productId: true, size: true, color: true, price: true, stock: true, active: true, createdAt: true, updatedAt: true },
    });
    return safeVariant(variant);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminProductError(409, "A variant with this size and color already exists for the product.");
    throw error;
  }
}

async function updateVariant(rawProductId, rawVariantId, body) {
  const productId = parsePathId(rawProductId, "product");
  const variantId = parsePathId(rawVariantId, "variant");
  const data = validateVariantFields(body);
  const existing = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
  if (!existing) throw new AdminProductError(404, "Variant not found for this product.");
  try {
    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data,
      select: { id: true, productId: true, size: true, color: true, price: true, stock: true, active: true, createdAt: true, updatedAt: true },
    });
    return safeVariant(variant);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminProductError(409, "A variant with this size and color already exists for the product.");
    if (error?.code === "P2025") throw new AdminProductError(404, "Variant not found for this product.");
    throw error;
  }
}

module.exports = {
  AdminProductError,
  buildListQuery,
  createProduct,
  createVariant,
  getProduct,
  listProducts,
  parsePathId,
  updateProduct,
  updateVariant,
  validateProductFields,
  validateVariantFields,
};
