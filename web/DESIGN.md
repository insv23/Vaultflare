# Web 前端设计文档

> **维护声明**：任何功能、架构、写法更新必须同步更新本文档及相关子目录的说明文件。

## 目录

1. [项目概述](#项目概述)
2. [技术栈与依赖版本](#技术栈与依赖版本)
3. [部署架构](#部署架构)
4. [目录结构](#目录结构)
5. [客户端密码学架构](#客户端密码学架构)
6. [页面与功能设计](#页面与功能设计)
7. [开发阶段](#开发阶段)
8. [关键技术决策](#关键技术决策)
9. [常用命令](#常用命令)

---

## 项目概述

### 核心职责

Vaultflare 的网页客户端。**浏览器是唯一信任边界**——所有加密/解密操作在本地完成，服务器只是加密数据的存储中转站。

用户完整闭环：注册 → 登录 → 查看/新增/编辑/删除密码 → 搜索 → 复制密码 → 生成随机密码 → 登出。

### 与后端的关系

- 后端提供 RESTful API（见 `backend/DESIGN.md`）
- 前端通过 `fetch` 调用后端 API，请求/响应体均为 JSON
- 前端发送到服务器的密码数据**始终是密文**，服务器无法解密

---

## 技术栈与依赖版本

> **重要**：添加或更新依赖前，必须联网搜索确认最新版本，禁止猜测。

| 依赖 | 版本 | 用途 |
|------|------|------|
| react + react-dom | Vite 模板自带 | UI 框架 |
| vite | ^6.1.0 | 构建工具 |
| @cloudflare/vite-plugin | ^1.24.0 | Cloudflare Workers 静态资源集成 |
| tailwindcss | ^4.1.18 | CSS 框架（v4 CSS-first 配置，无需 config 文件） |
| @tailwindcss/vite | ^4.1.18 | Tailwind 的 Vite 原生插件（替代 PostCSS） |
| shadcn (CLI) | ^3.8.4 | UI 组件库（按需 copy 进项目，不是 npm 运行时依赖） |
| react-router | ^7.13.0 | 客户端路由（v7 已合并 react-router-dom，只需装这一个包） |
| hash-wasm | ^4.12.0 | Argon2id WASM 实现（base64 内嵌，Vite 零配置） |
| Web Crypto API | 浏览器原生 | HKDF 密钥派生 + AES-GCM 加密解密 |

### shadcn/ui 关键依赖（由 `pnpm dlx shadcn@latest init` 自动安装）

| 依赖 | 说明 |
|------|------|
| radix-ui | 无障碍基础组件（统一包，非 @radix-ui/react-* 分包） |
| tw-animate-css | 动画支持（替代已废弃的 tailwindcss-animate） |
| clsx + tailwind-merge | `cn()` 工具函数 |
| class-variance-authority | 组件变体管理 |
| lucide-react | 图标库 |

### 运行环境

- **部署平台**: Cloudflare Workers Static Assets
- **构建工具**: Vite 6+
- **CLI**: Wrangler ^4.64.0

### react-router v7 注意事项

v7 将 `react-router-dom` 合并进了 `react-router`，只需安装一个包：

```bash
pnpm add react-router
```

导入方式：

```typescript
// 通用 hooks/组件
import { useLocation, useNavigate, Outlet } from "react-router";

// DOM 专属组件（依赖 react-dom）
import { BrowserRouter, RouterProvider } from "react-router/dom";
```

### Tailwind CSS v4 注意事项

v4 与 v3 有根本性架构变化：

- **无需 `tailwind.config.js`** — 配置直接写在 CSS 文件中，通过 `@theme` 指令
- **无需 `postcss.config.js`** — Vite 项目使用 `@tailwindcss/vite` 插件，不走 PostCSS
- **无需手动配置 content 路径** — 自动扫描项目文件
- **CSS 入口文件** — 只需一行 `@import "tailwindcss";`，替代旧版 `@tailwind base/components/utilities`
- **颜色系统** — 从 RGB 改为 OKLCH（更宽色域）
- **引擎** — Rust 实现，全量构建快 5x，增量构建快 100x

### shadcn/ui 安装注意事项

- **包名是 `shadcn`**，不是 `shadcn-ui`（后者已废弃停留在 0.9.5）
- **唯一可用风格是 `new-york`**，`default` 风格已废弃
- **`components.json` 中 `tailwind.config` 字段必须留空** `""`（v4 无 config 文件）
- **`rsc` 设为 `false`**（Vite 不支持 React Server Components）

---

## 部署架构

```
Cloudflare Workers Static Assets
├── 静态文件 (index.html, JS, CSS)  ← Vite 构建产物
└── wrangler.jsonc:
    assets.not_found_handling: "single-page-application"
    → 未匹配路径返回 index.html，React Router 接管客户端路由
```

纯 SPA，**不需要 Worker 脚本**。API 请求直接发到后端 Workers URL。

### 路由机制

1. 请求进来 → Cloudflare 先尝试匹配静态文件
2. 匹配到 → 直接返回文件（JS、CSS、图片等）
3. 未匹配 → 返回 `/index.html`（HTTP 200）→ React Router 接管
4. 静态资源服务免费，不消耗 Worker 请求配额

### API 通信

- 开发环境：`http://localhost:8787`（后端本地 dev server）
- 生产环境：后端 Workers 的部署 URL
- 通过环境变量 `VITE_API_BASE_URL` 配置

---

## 目录结构

```
web/
├── public/                        # 静态资源
├── src/
│   ├── main.tsx                   # React 入口
│   ├── App.tsx                    # 路由定义 + 全局 Layout
│   │
│   ├── crypto/                    # 客户端加密核心（最重要的模块）
│   │   ├── argon2.ts              # Argon2id 封装 (hash-wasm)
│   │   ├── keys.ts                # HKDF 密钥派生 (Web Crypto)
│   │   └── vault.ts               # AES-GCM 加密/解密 cipher 条目
│   │
│   ├── api/                       # 后端 API 调用
│   │   └── client.ts              # fetch 封装，自动注入 Bearer token
│   │
│   ├── context/                   # React Context 状态管理
│   │   ├── auth.tsx               # 认证状态 (token + MasterKey + userId)
│   │   └── vault.tsx              # 密码库状态 (ciphers + vault_version)
│   │
│   ├── pages/                     # 页面组件
│   │   ├── Login.tsx              # 登录页 (challenge + verify 两步)
│   │   ├── Register.tsx           # 注册页
│   │   └── Vault.tsx              # 密码库主页 (列表 + CRUD)
│   │
│   ├── components/                # 业务组件
│   │   ├── ui/                    # shadcn/ui 生成的基础组件
│   │   ├── CipherCard.tsx         # 单条密码卡片
│   │   ├── CipherForm.tsx         # 新增/编辑密码表单
│   │   ├── PasswordGenerator.tsx  # 随机密码生成器
│   │   └── SearchBar.tsx          # 搜索栏
│   │
│   └── lib/
│       └── utils.ts               # shadcn/ui 的 cn() 工具函数
│
├── components.json                # shadcn/ui 配置
├── vite.config.ts
├── tsconfig.json
├── package.json
├── wrangler.jsonc
└── DESIGN.md                      # 本文档
```

---

## 客户端密码学架构

这是前端最核心的模块，也是零知识架构的实现层。

### 密钥派生流程

```
用户输入主密码 (Master Password)
        ↓
    Argon2id(password, salt, {m:65536, t:3, p:4})    ← hash-wasm
        ↓
    IKM (Initial Key Material, 32 bytes)
        ↓ HKDF-SHA256 Expand                          ← Web Crypto API
        ├── info="master-key" → MasterKey (32 bytes)   永不离开浏览器内存
        └── info="auth-key"  → AuthKey (32 bytes)      发送到服务器用于认证
```

### 数据加密流程（创建/更新密码条目时）

```
1. 生成随机 DEK (Data Encryption Key, 32 bytes)     ← crypto.getRandomValues()
2. 生成随机 IV_data (12 bytes)
3. AES-256-GCM(DEK, IV_data, plaintext) → ciphertext_data
4. encrypted_data = base64(IV_data + ciphertext_data)  ← 发送到服务器

5. 生成随机 IV_dek (12 bytes)
6. AES-256-GCM(MasterKey, IV_dek, DEK) → ciphertext_dek
7. encrypted_dek = base64(IV_dek + ciphertext_dek)     ← 发送到服务器
```

### 数据解密流程（读取密码条目时）

```
1. 从服务器拿回 encrypted_dek + encrypted_data
2. 解码 base64(encrypted_dek) → IV_dek + ciphertext_dek
3. AES-256-GCM-Decrypt(MasterKey, IV_dek, ciphertext_dek) → DEK
4. 解码 base64(encrypted_data) → IV_data + ciphertext_data
5. AES-256-GCM-Decrypt(DEK, IV_data, ciphertext_data) → plaintext
```

### 明文数据结构（加密前的 cipher data）

```typescript
type CipherData = {
  name: string;        // 网站/服务名称
  username: string;    // 用户名/邮箱
  password: string;    // 密码
  uri?: string;        // 网址
  notes?: string;      // 备注
};
// JSON.stringify(cipherData) → AES-GCM 加密 → encrypted_data
```

### 安全约束

| 约束 | 说明 |
|------|------|
| MasterKey 仅存内存 | 不写 localStorage / sessionStorage / IndexedDB |
| 刷新 = 重新登录 | MasterKey 丢失后必须重新输入主密码派生 |
| access_token 存内存 | 和 MasterKey 同生命周期 |
| AES-GCM 每次随机 IV | 12 bytes，与密文拼接存储 |
| 每条密码独立 DEK | 更新一条不需要重新加密其他条目 |

### Argon2 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| memory (m) | 65536 KiB (64 MiB) | 对标 Bitwarden 默认值 |
| iterations (t) | 3 | OWASP 推荐级别 |
| parallelism (p) | 4 | 需 COOP/COEP 头才能真正多线程 |
| hashLength | 32 bytes | 256-bit 密钥 |

> **性能注意**：64 MiB + 3 次迭代在浏览器中约 1-3 秒（取决于设备），登录/注册时需要明确的 loading 状态。

---

## 页面与功能设计

### 页面 1：注册页 (`/register`)

**用户看到的**：Email + 主密码 + 确认密码 + 注册按钮

**内部流程**：
1. 前端生成 16 字节随机 salt
2. Argon2id(master_password, salt) → IKM
3. HKDF(IKM, "master-key") → MasterKey（存内存）
4. HKDF(IKM, "auth-key") → AuthKey
5. POST `/api/auth/register` 发送 `{ email, auth_key, kdf_salt, kdf_params }`
6. 成功 → 跳转登录页

### 页面 2：登录页 (`/login`)

**用户看到的**：Email + 主密码 + 登录按钮 + "Deriving keys..." loading

**内部流程（两步登录，对用户透明）**：
1. POST `/api/auth/login/challenge` → 拿到 `kdf_salt` + `kdf_params`
2. Argon2id(master_password, kdf_salt, kdf_params) → IKM
3. HKDF → MasterKey（存内存） + AuthKey
4. POST `/api/auth/login/verify` 发送 `{ email, auth_key }` → 拿到 `access_token`
5. 把 MasterKey + access_token + userId 存到 AuthContext
6. 跳转 `/vault`

### 页面 3：密码库主页 (`/vault`) — 需要认证

**功能清单**：

| 功能 | 说明 |
|------|------|
| 列表展示 | 登录后 GET `/api/ciphers` 全量拉取，本地解密后显示 |
| 新增密码 | 弹出表单，填写后加密 → POST `/api/ciphers` |
| 编辑密码 | 弹出表单预填，修改后加密 → PUT `/api/ciphers/:id`（带 expected_version） |
| 删除密码 | 确认对话框 → DELETE `/api/ciphers/:id`（带 expected_version） |
| 复制密码 | `navigator.clipboard.writeText()`，3 秒后自动清除剪贴板 |
| 搜索 | 纯前端过滤（数据已解密在内存），按 name/username 匹配 |
| 密码生成器 | 可配置长度和字符集，`crypto.getRandomValues()` 生成 |
| 登出 | POST `/api/auth/logout` → 清空内存中的 MasterKey + token → 跳转登录页 |

### 路由守卫

- AuthContext 检查 token 是否存在
- 无 token → 重定向到 `/login`
- token 过期（API 返回 401 token_expired）→ 清空状态 → 跳转登录页

---

## 开发阶段

### Phase 0：项目脚手架

```
1. pnpm create vite web -- --template react-ts
2. pnpm add tailwindcss @tailwindcss/vite
3. pnpm add -D @cloudflare/vite-plugin wrangler
4. 替换 src/index.css 为: @import "tailwindcss";
5. 配置 vite.config.ts (react + tailwindcss + cloudflare 三个插件)
6. 配置 tsconfig.json 路径别名 (@/ → ./src/*)
7. 配置 wrangler.jsonc (assets.not_found_handling: "single-page-application")
8. pnpm dlx shadcn@latest init (选 new-york 风格, neutral 基色)
9. pnpm add react-router hash-wasm
→ 验证: pnpm dev 能跑起来，访问任意路径返回 SPA
```

### Phase 1：客户端密码学核心

```
1. crypto/argon2.ts — Argon2id 封装
   → 验证: 给定 password+salt+params，输出稳定的 32 字节 IKM

2. crypto/keys.ts — HKDF 密钥派生
   → 验证: 同一 IKM 派生出的 MasterKey 和 AuthKey 稳定且不同

3. crypto/vault.ts — AES-GCM 加密/解密
   → 验证: encrypt → decrypt 回来得到原文；不同 IV 产生不同密文
```

**这是最关键的阶段。** 加密逻辑有 bug，后面全白做。必须先把这三个文件写对、测对。

### Phase 2：API 客户端 + 认证流程

```
1. api/client.ts — fetch 封装
   → 自动注入 Authorization: Bearer <token>
   → 统一错误处理

2. context/auth.tsx — 认证状态
   → 存储 token, userId, MasterKey (全部在内存)
   → 提供 login(), register(), logout() 方法

3. pages/Register.tsx — 注册页
   → 验证: 能注册成功，后端 users 表有记录

4. pages/Login.tsx — 登录页
   → 验证: 能登录成功，拿到 token，跳转 /vault
```

### Phase 3：密码库 CRUD

```
1. context/vault.tsx — 密码库状态
   → 登录后自动拉取全部 ciphers 并解密
   → 提供 create/update/delete 方法

2. pages/Vault.tsx — 主页面
   → 列表展示解密后的密码条目

3. components/CipherForm.tsx — 新增/编辑表单
   → 验证: 创建一条密码 → 刷新页面重新登录 → 数据还在且能正确解密

4. 删除功能
   → 验证: 软删除后列表不再显示

5. 复制密码到剪贴板
```

### Phase 4：完善体验

```
1. components/SearchBar.tsx — 搜索过滤
2. components/PasswordGenerator.tsx — 密码生成器
3. 会话过期处理 (token 过期 → 自动跳转登录)
4. 错误提示 (toast 通知)
5. 响应式布局 (移动端适配)
6. 版本冲突处理 (409 → 提示用户刷新)
```

---

## 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | React Context + hooks | 密码管理器状态不复杂，不需要外部库 |
| token 存储 | 内存 | 和 MasterKey 同生命周期，刷新即失效，最安全 |
| 刷新行为 | 重新登录 | MasterKey 不能持久化，这是零知识架构的代价 |
| 路由守卫 | Context 检查 token | 无 token → 重定向 /login |
| API base URL | 环境变量 VITE_API_BASE_URL | 开发时指向 localhost，生产指向后端 Workers URL |
| Argon2 库 | hash-wasm | WASM base64 内嵌、Vite 零配置、性能 2x argon2-browser |
| AES-GCM IV | 12 bytes 随机 | 每次加密随机生成，与密文拼接后 base64 编码存储 |
| 每条密码独立 DEK | 是 | 更新一条不影响其他条目，不需要全量重新加密 |
| Tailwind 版本 | v4 (4.1.18) | CSS-first 配置，无需 config 文件，@tailwindcss/vite 插件替代 PostCSS |
| shadcn/ui 风格 | new-york（唯一选项） | default 风格已废弃，使用统一 radix-ui 包 |

---

## 常用命令

```bash
# 开发
pnpm dev              # 启动本地开发服务器

# 构建
pnpm build            # TypeScript 检查 + Vite 构建

# 预览
pnpm preview          # 本地 Workers 运行时预览构建产物

# 部署
pnpm deploy           # 构建 + 部署到 Cloudflare
```

### 本地访问

- `http://localhost:5173` — 开发服务器（Vite 默认端口）
- 后端 API 需同时运行 `cd backend && pnpm dev`（默认 `http://localhost:8787`）

---

## 参考资源

- [Cloudflare Workers Static Assets + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/)
- [Cloudflare Workers SPA 路由](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [@cloudflare/vite-plugin](https://www.npmjs.com/package/@cloudflare/vite-plugin)
- [shadcn/ui Vite 安装指南](https://ui.shadcn.com/docs/installation/vite)
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [hash-wasm (Argon2id)](https://github.com/Daninet/hash-wasm)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**文档版本**: 1.1.0
**最后更新**: 2026-02-10
