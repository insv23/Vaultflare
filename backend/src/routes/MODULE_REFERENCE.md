# routes 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/routes` 负责定义 API 的协议边界（请求/响应 schema、状态码）并实现业务处理逻辑。

## `auth.ts`

- 职责: 实现认证生命周期接口，包含注册、登录 challenge、登录 verify、登出。
- 输入:
  - `POST /api/auth/register`: `email`, `auth_key`, `kdf_salt`, `kdf_params`。
  - `POST /api/auth/login/challenge`: `email`。
  - `POST /api/auth/login/verify`: `email`, `auth_key`。
  - `POST /api/auth/logout`: 来自 `authMiddleware` 注入的 `sessionToken`。
- 输出:
  - 注册成功返回 `user_id/email/vault_version`。
  - challenge 返回 `kdf_salt/kdf_params/vault_version` 供客户端派生密钥。
  - verify 返回 `Bearer access_token` 和过期时间。
  - logout 返回 `logged_out: true`。
- 依赖:
  - `utils/user-helper`（用户查询）
  - `utils/crypto`（token/时间/安全比较）
  - `utils/response`（统一错误结构）
  - D1 `users/sessions` 表
- 错误处理:
  - 重复邮箱返回 `409 email_already_exists`。
  - 凭据错误返回 `401 invalid_credentials`。
  - 请求字段非法由 Zod + `validationHook` 返回 `400 validation_error`。
- 边界条件:
  - 邮箱比较统一 `trim + lowercase`，不处理会导致重复账号绕过唯一性预期。
  - `kdf_params` 读取失败时回退为空对象，客户端需容忍该场景。
  - 路由响应状态码与 `createRoute.responses` 必须一致，否则 `RouteHandler` 类型不通过。

## `ciphers.ts`

- 职责: 实现密文条目的创建、查询、增量同步、更新和软删除，带乐观锁版本控制。
- 输入:
  - `POST /api/ciphers`: `encrypted_dek`, `encrypted_data`。
  - `GET /api/ciphers`: 无 body，依赖 `userId`。
  - `GET /api/ciphers/sync`: `since_version` query。
  - `GET /api/ciphers/{id}`: path `id`。
  - `PUT /api/ciphers/{id}`: `encrypted_dek`, `encrypted_data`, `expected_version`。
  - `DELETE /api/ciphers/{id}`: `expected_version` query。
- 输出:
  - 返回当前用户视角的 cipher 数据和 `vault_version`。
  - 更新/删除返回最新 `item_version` 与 `vault_version`，供客户端继续同步。
- 依赖:
  - `mappers/cipher.mapper`（行结构转响应结构）
  - `utils/crypto`（时间戳）
  - D1 `ciphers/users` 表与触发器（自动 bump 版本）
- 错误处理:
  - 资源不存在返回 `404 not_found`。
  - 版本不一致返回 `409 conflict`，并附 `expected/current`。
  - 鉴权失效返回 `401 unauthorized`。
  - 参数非法由 Zod 校验返回 `400`。
- 边界条件:
  - 软删除后 `get` 视为不存在（仍返回 `404`），但记录在同步接口中仍可见并带 `deleted_at`。
  - 删除接口对已删除记录是幂等行为，只要版本匹配仍返回成功结构。
  - `vault_version` 依赖 DB 触发器维护，若触发器缺失会导致同步语义失效。
