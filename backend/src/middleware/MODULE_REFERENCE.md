# middleware 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/middleware` 负责请求链路前置控制，包含会话鉴权和速率限制。

## `auth.ts`

- 职责: 校验 Bearer token，验证 session 状态，并向上下文注入 `userId` 与 `sessionToken`。
- 输入:
  - `Authorization: Bearer <token>` 请求头。
  - D1 `sessions` 表中的 `user_id/expires_at/revoked_at`。
- 输出:
  - 鉴权通过后调用 `next()`。
  - 通过 `c.set("userId")` 和 `c.set("sessionToken")` 把身份信息传给后续 handler。
- 依赖:
  - `utils/crypto.nowMs`
  - `utils/response.AppError`
  - `types.AppEnv`
- 错误处理:
  - 缺失或格式错误 token -> 抛 `401 unauthorized`。
  - token 不存在或已撤销 -> 抛 `401 unauthorized`。
  - token 已过期 -> 抛 `401 token_expired`。
- 边界条件:
  - 只接受前缀精确为 `Bearer ` 的头；大小写和其他方案不会被接受。
  - token 会 `trim`，可容忍尾部空格。
  - 如果 session 数据异常（例如 `expires_at` 非法），会走过期判断并被拒绝。

## `rate-limit.ts`

- 职责: 工厂函数，生成基于 D1 计数的限速中间件。
- 输入:
  - `CF-Connecting-IP` 请求头（作为限速 key）。
  - `limit`（限额）、`period`（窗口秒数）、`keyPrefix`（端点标识）。
  - D1 `rate_limits` 表做计数存储。
- 输出:
  - 限速通过则调用 `next()` 放行。
  - 超限则抛 `AppError(429, "rate_limit_exceeded")`。
- 依赖:
  - `types.AppEnv`（通过 `c.env.DB` 访问 D1）
  - `utils/response.AppError`
- 错误处理:
  - 超限 -> 抛 `429 rate_limit_exceeded`，由全局 `handleError` 转换为标准响应。
- 边界条件:
  - 无 `CF-Connecting-IP` 头时回退为 `"unknown"`，所有无 IP 请求共享同一限速桶。
  - 过期 window 行不会自动清理，需要定期手动或 Cron 清理。
