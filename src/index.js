import mongoose from "mongoose";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { ensureAdmin } from "./bootstrap.js";
import { logger } from "./utils/logger.js";

const app = createApp();

// One-time init (DB connection + first admin). Cached so warm invocations reuse it.
let ready;
const init = () =>
  (ready ??= (async () => {
    await connectDb();
    await ensureAdmin();
  })().catch((e) => {
    ready = undefined; // allow retry on the next request
    throw e;
  }));

// Vercel (serverless): export a handler instead of calling listen()
export default async function handler(req, res) {
  try {
    await init();
  } catch (e) {
    logger.error("Init failed", { message: e.message });
    return res.status(503).json({ error: "Database is unavailable right now" });
  }
  return app(req, res);
}

// Local development: normal long-running server
if (!process.env.VERCEL) {
  init()
    .then(() => {
      const server = app.listen(env.port, () =>
        logger.info(`API running on http://localhost:${env.port}`),
      );

      const stop = (sig) => {
        logger.info(`Shutting down (${sig})`);
        server.close(async () => {
          await mongoose.disconnect();
          process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();
      };
      ["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => stop(s)));
    })
    .catch((e) => {
      logger.error("Startup failed", { message: e.message });
      process.exit(1);
    });

  process.on("unhandledRejection", (reason) =>
    logger.error("unhandledRejection", { reason: String(reason) }),
  );
  process.on("uncaughtException", (e) => {
    logger.error("uncaughtException", { message: e.message, stack: e.stack });
    process.exit(1);
  });
}
