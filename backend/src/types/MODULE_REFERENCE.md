# types 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/types` 统一维护后端跨模块共享的类型契约，避免路由、中间件和工具函数对上下文结构理解不一致。

## `index.ts`

- 职责: 定义 `AppEnv` 与 `ErrorPayload`，作为 backend 内部公共类型入口。
- 输入:
  - Cloudflare Workers 运行时提供的 `D1Database` 绑定类型。
  - middleware 注入上下文变量约定。
- 输出:
  - `AppEnv`: 约束 `Bindings.DB` 和 `Variables.userId/sessionToken`。
  - `ErrorPayload`: 统一错误响应结构 `{ error: { code, message, details? } }`。
- 依赖: Cloudflare 类型声明（`D1Database`）。
- 错误处理: 仅类型定义，无运行时分支。
- 边界条件:
  - `AppEnv.Variables` key 变更会影响所有 `c.get/c.set` 调用点，属于高影响改动。
  - `ErrorPayload` 若扩展字段，`utils/response.ts` 与所有手写错误响应需同步。
