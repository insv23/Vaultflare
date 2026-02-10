// input: Authorization header with Bearer token plus sessions/users tables.
// output: authenticated userId/sessionToken injected into request context.
// pos: request gatekeeper for protected API routes.

import type { MiddlewareHandler } from "hono";

import type { AppEnv } from "../types";
import { nowMs } from "../utils/crypto";
import { AppError } from "../utils/response";

type SessionRow = {
  user_id: string;
  expires_at: number;
  revoked_at: number | null;
};

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new AppError(401, "unauthorized", "Missing or invalid authorization token");
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    throw new AppError(401, "unauthorized", "Missing or invalid authorization token");
  }

  const session = await c.env.DB.prepare(
    `SELECT user_id, expires_at, revoked_at
     FROM sessions
     WHERE token = ?`,
  )
    .bind(token)
    .first<SessionRow>();

  if (!session || session.revoked_at !== null) {
    throw new AppError(401, "unauthorized", "Invalid authorization token");
  }

  if (session.expires_at <= nowMs()) {
    throw new AppError(401, "token_expired", "Session token has expired");
  }

  c.set("userId", session.user_id);
  c.set("sessionToken", token);

  await next();
};
