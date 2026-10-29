import bcrypt from "bcryptjs";
import { env } from "./config/env.js";
import { User } from "./models/User.js";
import { logger } from "./utils/logger.js";

// بيعمل الأدمن الأول من .env لو مفيش ولا مستخدم (آمن للتشغيل أكتر من مرة)
export async function ensureAdmin() {
  if (await User.estimatedDocumentCount()) return null;
  const admin = await User.create({
    username: env.adminUsername,
    passwordHash: await bcrypt.hash(env.adminPassword, env.bcryptRounds),
    role: "admin",
  });
  logger.info(`Admin created: ${admin.username}`);
  return admin;
}
