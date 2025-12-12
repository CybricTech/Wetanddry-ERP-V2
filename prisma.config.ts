
// Prisma Config for Next.js with dotenv
import { resolve } from "path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load environment variables from .env.local first (Next.js pattern)
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
    directUrl: process.env.DIRECT_URL || undefined,
  },
});
