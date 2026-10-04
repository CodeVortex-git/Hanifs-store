const prisma = require("./prisma");

const publicProductSelect = {
  id: true,
  name: true,
  category: true,
  gender: true,
  basePrice: true,
  imageUrl: true,
  imageAlt: true,
  description: true,
  featured: true,
  newArrival: true,
  active: true,
  variants: {
    where: { active: true },
    orderBy: [{ productId: "asc" }, { id: "asc" }],
    select: {
      id: true,
      size: true,
      color: true,
      price: true,
      stock: true,
      active: true,
    },
  },
};

async function getActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
    select: publicProductSelect,
  });
}

async function getActiveProductById(id) {
  return prisma.product.findFirst({
    where: { id, active: true },
    select: publicProductSelect,
  });
}

module.exports = { getActiveProducts, getActiveProductById };
