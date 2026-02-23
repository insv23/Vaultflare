// input: CF-Connecting-IP header + D1 database for counting.
// output: 通过则放行，超限则抛 AppError 429。
// pos: 公开 auth 端点的请求频率守卫。

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";
import { AppError } from "../utils/response";

export const rateLimitMiddleware = (
  limit: number,
  period: number,
  keyPrefix: string,
): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const key = `${ip}:${keyPrefix}`;
    const windowStart = Math.floor(Date.now() / 1000 / period) * period;

    const [, result] = await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1`,
      ).bind(key, windowStart),
      c.env.DB.prepare(
        `SELECT count FROM rate_limits WHERE key = ? AND window_start = ?`,
      ).bind(key, windowStart),
    ]);

    const row = result.results?.[0] as { count: number } | undefined;
    if (row && row.count > limit) {
      throw new AppError(429, "rate_limit_exceeded", "Too many requests, please try again later");
    }
    await next();
  };
};
