# src 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src` 是后端运行时代码根目录，负责把 HTTP 请求接入、鉴权、路由分发、错误规范和数据映射串成一个完整服务。

## `index.ts`

- 职责: 应用组合根。创建 `OpenAPIHono` 实例，挂载全局校验钩子、错误处理、文档路由、健康检查、鉴权中间件和业务路由。
- 输入:
  - Cloudflare Workers 请求上下文。
  - `AppEnv` 中的 `DB` 绑定。
  - 来自 `routes/*` 的 route 注册函数。
- 输出:
  - 默认导出 `app`，供 Workers 运行时作为入口。
  - 暴露 `/health`、`/openapi.json`、`/docs`、`/api/auth/*`、`/api/ciphers*`。
- 依赖:
  - `./middleware/auth`
  - `./routes/auth`
  - `./routes/ciphers`
  - `./utils/response`
  - `@hono/zod-openapi`, `@scalar/hono-api-reference`
- 错误处理:
  - 所有抛出的异常统一走 `app.onError -> handleError`。
  - 请求验证失败由 `defaultHook: validationHook` 统一转为 `400`。
- 边界条件:
  - `authMiddleware` 仅挂到受保护路径，公开路径（`/health`、`/docs`、`/openapi.json`、注册/登录）不鉴权。
  - 新增受保护路由时，必须同步在此文件挂载中间件，否则会出现未鉴权访问。

## `routes/`

- 职责: 按业务域定义 HTTP API 的 schema、状态码和 handler。
- 输入:
  - 经过 Hono 解析的请求（path/query/json/header）。
  - 来自中间件注入的 `userId/sessionToken`（受保护路由）。
- 输出:
  - 认证 API 和密文数据 API。
  - 自动参与 OpenAPI 文档生成。
- 依赖: `@hono/zod-openapi`、`utils/*`、`mappers/*`、`types/*`。
- 错误处理:
  - 业务冲突/不存在等错误返回标准 `error` 结构。
  - 参数错误由 `validationHook` 统一处理。
- 边界条件:
  - 状态码必须与 `createRoute().responses` 完全匹配，否则会出现 TypeScript 类型冲突。
  - `auth.ts` 与 `ciphers.ts` 的错误结构需保持一致，避免前端分支爆炸。

## `middleware/`

- 职责: 请求前置拦截与上下文注入。
- 输入: HTTP Header（尤其 `Authorization`）。
- 输出: 在 `c` 上写入 `userId/sessionToken`，供后续 handler 使用。
- 依赖: `utils/crypto`、`utils/response`、`types`。
- 错误处理: 鉴权失败抛 `AppError`，由全局错误处理转换为标准响应。
- 边界条件: 若新增 token 形态（非 Bearer）需在此扩展，否则会全部返回 `401`。

## `utils/`

- 职责: 提供跨模块复用能力（错误响应、会话工具、用户查询）。
- 输入: 路由/中间件传入的数据库连接、业务参数、错误对象。
- 输出: 可复用函数（不直接注册路由）。
- 依赖: `hono`、D1 API、原生 `crypto`。
- 错误处理: `response.ts` 是统一错误策略入口。
- 边界条件: 这里函数被多模块复用，变更函数签名会引发广泛连锁修改。

## `types/`

- 职责: 汇总运行时上下文类型契约。
- 输入: Cloudflare Bindings 和 middleware 注入变量定义。
- 输出: `AppEnv`、`ErrorPayload` 类型。
- 依赖: Cloudflare Workers 类型声明。
- 错误处理: 无运行时逻辑，仅约束编译期类型。
- 边界条件: `Variables` 字段名必须和 `c.set/c.get` 使用的 key 一致，否则类型和运行时脱节。

## `mappers/`

- 职责: 数据库行结构和 API 响应结构之间的稳定转换。
- 输入: D1 查询返回行。
- 输出: 对外响应字段（如 `cipher_id`）和数值类型归一化结果。
- 依赖: 当前为纯函数，无外部 IO 依赖。
- 错误处理: 不抛业务错误，假定输入字段齐全。
- 边界条件: 数据库列名改动时，这里必须先更新，否则路由会返回错误字段或错误类型。
