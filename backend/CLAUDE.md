# Backend

Hono + Cloudflare Workers + D1 后端服务。

## API 文档方案

使用 **@hono/zod-openapi** + **@scalar/hono-api-reference** 组合：

- `@hono/zod-openapi`: 用 Zod schema 定义路由，自动生成 OpenAPI 规范
- `@scalar/hono-api-reference`: 渲染 OpenAPI 为可交互的 API 文档界面

### 为什么这样选

1. **类型安全**: Zod schema 同时用于请求验证和类型推导
2. **文档即代码**: OpenAPI 规范从路由定义自动生成，不会过时
3. **前端友好**: web 和 chrome-extension 可以直接看文档调用 API

## 如何编写 API 端点

### 步骤概览

1. 定义 Zod schema（请求参数、响应体）
2. 用 `createRoute()` 定义路由元信息
3. 用 `app.openapi()` 注册路由并实现逻辑

### 完整示例

```typescript
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

const app = new OpenAPIHono();

// 1. 定义响应 schema
const UserSchema = z
  .object({
    id: z.string().openapi({ example: "123" }),
    name: z.string().openapi({ example: "张三" }),
    email: z.string().email().openapi({ example: "zhangsan@example.com" }),
  })
  .openapi("User"); // 这个名字会显示在文档的 Schemas 里

// 2. 定义路由
const getUserRoute = createRoute({
  method: "get",
  path: "/users/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ description: "用户 ID", example: "123" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: UserSchema } },
      description: "获取用户成功",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
      description: "用户不存在",
    },
  },
  tags: ["用户"],           // 文档里的分组
  summary: "获取用户信息",   // 简短标题
  description: "根据用户 ID 获取用户详细信息", // 详细说明
});

// 3. 注册路由并实现逻辑
app.openapi(getUserRoute, (c) => {
  const { id } = c.req.valid("param"); // 类型安全的参数获取

  if (id === "123") {
    return c.json({ id: "123", name: "张三", email: "zhangsan@example.com" });
  }

  return c.json({ message: "用户不存在" }, 404);
});
```

### 常用 request 字段

```typescript
createRoute({
  request: {
    params: z.object({ id: z.string() }),           // 路径参数 /users/{id}
    query: z.object({ page: z.string().optional() }), // 查询参数 ?page=1
    body: {                                          // 请求体
      content: { "application/json": { schema: MySchema } },
    },
    headers: z.object({ "x-api-key": z.string() }), // 请求头
  },
})
```

### 在 handler 中获取已验证的数据

```typescript
app.openapi(route, (c) => {
  const { id } = c.req.valid("param");   // 路径参数
  const { page } = c.req.valid("query"); // 查询参数
  const body = c.req.valid("json");      // 请求体
  const headers = c.req.valid("header"); // 请求头
});
```

## 常用命令

```bash
pnpm dev        # 本地开发
pnpm deploy     # 部署到 Cloudflare
pnpm cf-typegen # 生成 Cloudflare Bindings 类型
```

## 本地访问

- `/api/openapi.json` — OpenAPI 规范 JSON
- `/api/docs` — Scalar 文档界面

## 改动后校验要求

每次改动后端代码后，必须执行以下命令进行类型检查：

```bash
cd backend && pnpm -s tsc --noEmit
```
