import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/error.js";
import { requestId } from "./middlewares/requestId.js";
import { sanitize } from "./middlewares/sanitize.js";
import routes from "./routes/index.js";
import { ApiError } from "./utils/ApiError.js";

// createApp بتبني الـ app بس (من غير اتصال بقاعدة البيانات) عشان الاختبارات
export function createApp({ rateLimit = {} } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", env.trustProxy);

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      credentials: true, // عشان الكوكيز تتبعت من الواجهة
      origin: (origin, cb) =>
        !origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(ApiError.forbidden("This origin is not allowed", { code: "CORS_BLOCKED" })),
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
