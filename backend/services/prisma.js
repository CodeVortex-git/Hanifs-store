const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

// server.js loads the repository-root .env. The database URL for this backend
// lives in backend/.env, so load that file when the process environment has not
// already supplied the URL.
if (!process.env.DATABASE_URL) {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
}

const prisma =
  globalThis.__hanifsStorePrisma ||
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__hanifsStorePrisma = prisma;
}

module.exports = prisma;
