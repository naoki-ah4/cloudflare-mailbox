import { PrismaClient } from "../../generated/prisma";

let prisma: PrismaClient | undefined;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
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

// KV互換のエイリアス
export { UserDB as UserKV } from "./user";
export { SessionDB as SessionKV } from "./session";
export {
  AdminDB as AdminKV,
  AdminSessionDB as AdminSessionKV,
  InviteDB as InviteKV,
} from "./admin";
export {
  MessageDB as MessageKV,
  InboxDB as InboxKV,
  ThreadDB as ThreadKV,
} from "./email";
export {
  UserSettingsDB as SettingsKV,
  SystemSettingsDB as SystemKV,
} from "./settings";
export { RateLimitDB as RateLimitKV } from "./rate-limit";
export { FolderDB as FolderKV } from "./folder";
export { OutboxDB as OutboxKV } from "./outbox";
