import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureAdmin } from "./bootstrap.js";
import { errorHandler, notFound } from "./middlewares/error.js";
import { requestId } from "./middlewares/requestId.js";
import { sanitize } from "./middlewares/sanitize.js";
import routes from "./routes/index.js";
import { ApiError } from "./utils/ApiError.js";

// createApp builds the app only (no database connection), so tests can use it
export function createApp({ rateLimit = {} } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", env.trustProxy);

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      credentials: true, // so cookies are sent from the frontend
      origin: (origin, cb) =>
        !origin || env.corsOrigins.includes(origin)
          ? cb(null, true)
          : cb(
              ApiError.forbidden("This origin is not allowed", {
                code: "CORS_BLOCKED",
              }),
            ),
    }),
  );
  app.use(express.json({ limit: `${env.bodyLimitKb}kb` }));
  app.use(cookieParser());
  app.use(sanitize);

  app.use("/api", routes(rateLimit));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// ---- Vercel (serverless) entry: default export must be a function ----
let app;
let ready;
const init = () =>
  (ready ??= (async () => {
    await connectDb();
    await ensureAdmin();
  })().catch((e) => {
    ready = undefined; // retry on the next request
    throw e;
  }));

export default async function handler(req, res) {
  try {
    await init();
  } catch (e) {
    console.error("Init failed:", e.message);
    return res.status(503).json({ error: "Database is unavailable right now" });
  }

  // Restore the original path that the rewrite replaced
  const u = new URL(req.url, "http://localhost");
  const p = u.searchParams.get("__p");
  if (p !== null) {
    u.searchParams.delete("__p");
    req.url = "/" + p + u.search;
  }

  app ??= createApp();
  return app(req, res);
}
