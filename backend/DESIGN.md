# Backend 设计文档

> **维护声明**：任何功能、架构、写法更新必须同步更新本文档及相关子目录的说明文件。

## 目录

1. [项目概述](#项目概述)
2. [技术栈与依赖版本](#技术栈与依赖版本)
3. [目录结构](#目录结构)
4. [数据库设计](#数据库设计)
5. [API 设计](#api-设计)
6. [开发指南](#开发指南)
7. [常用命令](#常用命令)
8. [冒烟测试脚本](#冒烟测试脚本)

---

## 项目概述

### 核心理念

零知识 (Zero-Knowledge) 架构的密码管理器后端：

- **服务器不可信**：服务器只存储加密数据，永远无法解密用户数据
- **客户端是唯一信任边界**：所有加密/解密操作在客户端进行
- **主密码不离开本地**：用户主密码永不传输到服务器

### 密码学架构

```
用户主密码 (Master Password)
    ↓ Argon2id (慢速KDF)
初始密钥材料 (IKM)
    ↓ HKDF 分离
    ├─→ MasterKey (MK) - 用于加密DEK，永不发送到服务器
    └─→ AuthKey (AK) - 用于服务器认证，发送到服务器存储

数据加密流程：
PlaintextEntry → [DEK加密] → EncryptedData
DEK → [MasterKey加密] → EncryptedDEK

服务器存储：EncryptedDEK + EncryptedData
```

---

## 技术栈与依赖版本

> **重要**：添加或更新依赖前，必须通过 `npm view <package> version` 确认最新版本。

| 依赖 | 版本 | 用途 |
|-----|------|------|
| hono | ^4.11.9 | Web 框架 |
| zod | ^4.3.6 | Schema 验证（v4 版本） |
| @hono/zod-openapi | ^1.2.1 | OpenAPI 文档生成（已支持 Zod v4） |
| @scalar/hono-api-reference | ^0.9.40 | API 文档 UI |

### 运行环境

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite-based)
- **CLI**: Wrangler

---

## 目录结构

```
backend/
├── db/
│   └── schema.sql              # 数据库 schema
├── src/
│   ├── index.ts                # 主入口
│   ├── types/
│   │   └── index.ts            # 类型定义
│   ├── utils/
│   │   ├── response.ts         # 统一响应格式
│   │   ├── crypto.ts           # 加密工具
│   │   └── user-helper.ts      # 用户帮助函数
│   ├── middleware/
│   │   └── auth.ts             # 认证中间件
│   ├── routes/
│   │   ├── auth.ts             # 认证路由
│   │   └── ciphers.ts          # 密码条目路由
│   └── mappers/
│       └── cipher.mapper.ts    # 数据转换
├── DESIGN.md                   # 本文档
├── CLAUDE.md                   # AI 协作说明
├── package.json
├── wrangler.jsonc
└── tsconfig.json
```

---

## 数据库设计

### 表结构概览

| 表名 | 用途 |
|-----|------|
| users | 用户认证信息和密钥派生参数 |
| ciphers | 加密的密码条目 |
| sessions | 会话令牌管理 |

### Schema 详细定义

见 `db/schema.sql`，包含：

- 3 张核心表
- 5 个触发器（自动更新时间戳和 vault_version）
- 优化索引

### 关键字段说明

#### users 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | UUID v4，主键 |
| email | TEXT | 用户邮箱，唯一 |
| auth_key | TEXT | Base64 编码的 AuthKey (32字节) |
| kdf_salt | TEXT | Base64 编码的盐值 (16字节) |
| kdf_params | TEXT | JSON 字符串，Argon2 参数 |
| vault_version | INTEGER | 密码库版本号，每次条目变更自增 |

#### ciphers 表

| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT | UUID v4，主键 |
| user_id | TEXT | 关联 users.id |
| encrypted_dek | TEXT | Base64 编码的加密 DEK |
| encrypted_data | TEXT | Base64 编码的加密数据 |
| item_version | INTEGER | 条目版本号，用于冲突检测 |
| deleted_at | INTEGER | 软删除时间戳，NULL 表示未删除 |

---

## API 设计

### 响应格式（Stripe 风格）

采用直接响应模式，HTTP 状态码即表明成功/失败，无需额外包装。

**成功响应** (HTTP 2xx) — 直接返回数据：

```json
// 单个资源 (200 OK)
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "vault_version": 42
}

// 创建成功 (201 Created)
{
  "cipher_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "item_version": 1,
  "created_at": 1705320000000
}

// 列表响应 (200 OK)
{
  "vault_version": 42,
  "ciphers": [
    { "cipher_id": "...", "encrypted_dek": "...", "encrypted_data": "..." }
  ]
}

// 删除成功 (200 OK)
{
  "cipher_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "deleted_at": 1705320400000
}
```

**错误响应** (HTTP 4xx/5xx) — 统一错误对象：

```json
{
  "error": {
    "code": "email_already_exists",
    "message": "This email is already registered"
  }
}

// 带详情的验证错误 (400)
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": {
      "email": "Invalid email format",
      "kdf_params.iterations": "Must be a positive integer"
    }
  }
}

// 版本冲突 (409)
{
  "error": {
    "code": "conflict",
    "message": "Version conflict",
    "details": {
      "expected_version": 5,
      "current_version": 7
    }
  }
}
```

### 设计原则

1. **HTTP 状态码即语义** — 2xx 成功，4xx 客户端错误，5xx 服务端错误
2. **成功时直接返回数据** — 无需 `.data` 解包
3. **错误时统一结构** — 始终包含 `error.code` 和 `error.message`
4. **可选 details** — 仅在需要时提供额外错误信息

### 错误代码

| 错误代码 | HTTP 状态码 | 说明 |
|---------|------------|------|
| validation_error | 400 | 请求参数验证失败 |
| invalid_credentials | 401 | 邮箱或密码错误 |
| unauthorized | 401 | 未提供认证令牌或令牌无效 |
| token_expired | 401 | 会话令牌已过期 |
| forbidden | 403 | 无权访问该资源 |
| not_found | 404 | 资源不存在 |
| email_already_exists | 409 | 邮箱已被注册 |
| conflict | 409 | 版本冲突 |
| internal_error | 500 | 服务器内部错误 |

### API 端点

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | - |
| POST | /api/auth/login/challenge | 获取登录挑战参数 | - |
| POST | /api/auth/login/verify | 验证登录凭证 | - |
| POST | /api/auth/logout | 登出 | Bearer |
| POST | /api/ciphers | 创建密码条目 | Bearer |
| GET | /api/ciphers | 获取所有条目（全量） | Bearer |
| GET | /api/ciphers/sync | 增量同步 | Bearer |
| GET | /api/ciphers/:id | 获取单个条目 | Bearer |
| PUT | /api/ciphers/:id | 更新条目 | Bearer |
| DELETE | /api/ciphers/:id | 删除条目（软删除） | Bearer |

---

## 开发指南

### @hono/zod-openapi 用法

#### 1. 定义 Schema

```typescript
import { z } from '@hono/zod-openapi'

// 响应 Schema
const UserSchema = z
  .object({
    id: z.string().openapi({ example: '550e8400-e29b-41d4-a716-446655440000' }),
    email: z.string().openapi({ example: 'user@example.com' }),
  })
  .openapi('User')

// 路径参数 Schema
const ParamsSchema = z.object({
  id: z.string().openapi({
    param: { name: 'id', in: 'path' },
    example: '550e8400-e29b-41d4-a716-446655440000',
  }),
})
```

#### 2. 创建路由定义

```typescript
import { createRoute } from '@hono/zod-openapi'

const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['用户'],
  summary: '获取用户信息',
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSchema } },
      description: '获取成功',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: '用户不存在',
    },
  },
})
```

#### 3. 注册路由

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'

const app = new OpenAPIHono()

app.openapi(getUserRoute, (c) => {
  const { id } = c.req.valid('param')
  // 实现逻辑...
  return c.json({ id, email: 'user@example.com' })
})
```

#### 4. 获取已验证的数据

```typescript
app.openapi(route, (c) => {
  const params = c.req.valid('param')   // 路径参数
  const query = c.req.valid('query')    // 查询参数
  const body = c.req.valid('json')      // 请求体
  const headers = c.req.valid('header') // 请求头
})
```

### Zod v4 注意事项

Zod v4 有重大 API 变化：

```typescript
// v4 新增顶级函数
z.email()    // 替代 z.string().email()
z.uuid()     // 替代 z.string().uuid()
z.url()      // 替代 z.string().url()

// 错误自定义
z.string().min(5, { error: "Too short." })  // v4 用 error
// z.string().min(5, { message: "..." })    // v3 用 message
```

---

## 常用命令

```bash
# 开发
pnpm dev              # 启动本地开发服务器

# 部署
pnpm run deploy       # 部署到 Cloudflare

# 类型生成
pnpm cf-typegen       # 生成 Cloudflare Bindings 类型

# 数据库
pnpm db:create        # 创建 D1 数据库
pnpm db:init          # 初始化本地数据库
pnpm db:init:remote   # 初始化远程数据库
```

### 本地访问

- `/openapi.json` — OpenAPI 规范 JSON
- `/docs` — Scalar API 文档界面
- `/health` — 健康检查

---

## 冒烟测试脚本

用于快速验证后端核心链路是否可用，脚本路径：

- `backend/scripts/smoke-test.sh`

### 覆盖范围

- 健康检查：`GET /health`
- 认证流程：`register -> login/challenge -> login/verify -> logout`
- 密文流程：`create -> list -> sync -> get -> update -> delete`
- 登出后鉴权失效校验：受保护接口应返回 `401`

### 运行前置条件

- 已安装 `httpie`（命令 `http`）和 `jq`
- 本地后端服务已启动（默认 `http://127.0.0.1:8787`）

### 运行方式

在仓库根目录运行：

```bash
./backend/scripts/smoke-test.sh
```

或在 `backend` 目录运行：

```bash
./scripts/smoke-test.sh
```

自定义服务地址示例：

```bash
BASE_URL=http://127.0.0.1:8787 ./backend/scripts/smoke-test.sh
```

---

## 参考资源

- [Zod v4 文档](https://zod.dev/v4)
- [@hono/zod-openapi](https://hono.dev/examples/zod-openapi)
- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Hono 框架文档](https://hono.dev/)

---

**文档版本**: 1.1.0
**最后更新**: 2026-02-09
