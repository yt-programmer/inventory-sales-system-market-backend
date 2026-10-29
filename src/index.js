import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureAdmin } from "./bootstrap.js";
import { logger } from "./utils/logger.js";

async function main() {
  await connectDb();
  await ensureAdmin();
  const server = createApp().listen(env.port, () => logger.info(`API running on http://localhost:${env.port}`));

  const stop = (sig) => {
    logger.info(`Shutting down (${sig})`);
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  ["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => stop(s)));
  process.on("unhandledRejection", (reason) => logger.error("unhandledRejection", { reason: String(reason) }));
  process.on("uncaughtException", (e) => { logger.error("uncaughtException", { message: e.message, stack: e.stack }); process.exit(1); });
}

main().catch((e) => { logger.error("Startup failed", { message: e.message }); process.exit(1); });
