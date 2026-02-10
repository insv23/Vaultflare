# utils 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/utils` 提供跨路由和中间件复用的基础能力：错误响应规范、会话安全工具、用户查询函数。

## `response.ts`

- 职责: 统一错误对象构造、校验错误转译、全局异常到 HTTP 响应的转换。
- 输入:
  - 业务抛出的 `AppError`。
  - Hono 抛出的 `HTTPException`。
  - Zod 校验结果 `issues`。
- 输出:
  - `errorPayload/errorJson`：标准错误体。
  - `validationHook`：请求校验失败时的 `400` 响应。
  - `handleError`：全局错误处理函数。
- 依赖: `hono`、`types/ErrorPayload`。
- 错误处理:
  - `AppError` 保留业务 `status/code/message/details`。
  - `HTTPException` 统一映射为 `internal_error`（保留状态码）。
  - 未知错误降级为 `500 internal_error`。
- 边界条件:
  - `errorJson` 状态码类型较宽，路由中若要满足字面量状态码约束，优先用 `c.json(errorPayload(...), 401)` 这种写法。

## `crypto.ts`

- 职责: 提供会话 token 生成、常量时间字符串比较、时间戳与过期时间计算。
- 输入:
  - 随机数源 `crypto.getRandomValues`。
  - 待比较字符串。
- 输出:
  - `generateSessionToken()`：base64url token。
  - `secureCompare()`：抗时序比较结果。
  - `nowMs()/sessionExpiresAtMs()`：毫秒级时间工具。
- 依赖: Workers 原生 `crypto` 与 `btoa`。
- 错误处理: 无显式异常封装，调用方处理运行时异常。
- 边界条件:
  - `SESSION_TTL_DAYS` 改动会直接影响登录态有效期。
  - `secureCompare` 长度不同立即返回 `false`，可避免无意义循环。

## `user-helper.ts`

- 职责: 封装用户查询 SQL，避免路由重复写查询语句和邮箱标准化逻辑。
- 输入:
  - D1 数据库连接。
  - `email` 或 `userId`。
- 输出:
  - `findUserByEmail` / `findUserById`，返回 `UserRow | null`。
- 依赖: D1 `users` 表。
- 错误处理:
  - 查询不到时统一返回 `null`，不抛异常。
- 边界条件:
  - `findUserByEmail` 内部会做 `trim + lowercase`，外层重复处理虽不报错但会产生重复规范化。
  - 若 `users` 表字段变更，必须同步更新 `SELECT` 列和 `UserRow` 类型。
