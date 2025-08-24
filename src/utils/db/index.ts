import { PrismaClient } from "../../generated/prisma";
import { PrismaTiDBCloud } from "@tidbcloud/prisma-adapter";

let prisma: PrismaClient | undefined;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    const adapter = new PrismaTiDBCloud({
      url: process.env.DATABASE_URL || "",
    });
    prisma = new PrismaClient({
      adapter,
      log: ["query", "error", "warn"],
      errorFormat: "pretty",
    });
  }
  return prisma;
};

export const closePrismaClient = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
};

export * from "./user";
export * from "./session";
export * from "./admin";
export * from "./email";
export * from "./settings";
export * from "./rate-limit";
export * from "./folder";
export * from "./outbox";
