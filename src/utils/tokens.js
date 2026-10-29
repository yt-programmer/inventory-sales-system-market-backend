import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.jwtExpiresIn,
  });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
