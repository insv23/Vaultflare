# middleware 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/middleware` 负责请求链路前置控制，当前只处理会话鉴权。

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
