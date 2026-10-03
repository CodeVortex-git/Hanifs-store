// Seed data for initial product catalog (16 products)
// Generates 10 variants per product (Cartesian product of sizes × colors)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDatabase() {
  // Clear existing data (use with caution in production)
  await prisma.$transaction([
    prisma.OrderItem.deleteMany(),
    prisma.Order.deleteMany(),
    prisma.ProductVariant.deleteMany(),
    prisma.Product.deleteMany(),
  ]);

  // Create all products from the frontend catalog
  const products = [