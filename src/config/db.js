import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

mongoose.set("strictQuery", true);

export async function connectDb(uri = env.mongoUri, options = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, ...options });
  // يتأكد إن الـ indexes (زي unique) اتعملت قبل أي طلب
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  logger.info("Connected to the database");
}

export const disconnectDb = () => mongoose.disconnect();
