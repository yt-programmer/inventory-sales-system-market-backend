import mongoose from "mongoose";

// لو TEST_MONGO_URI موجود بيستخدمه، غير كده بيشغّل mongodb-memory-server
export async function startDb(name) {
  if (process.env.TEST_MONGO_URI) {
    await mongoose.connect(process.env.TEST_MONGO_URI, { dbName: name });
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    return async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); };
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri(), { dbName: name });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return async () => { await mongoose.disconnect(); await mem.stop(); };
}
