# Vaultflare Raycast Extension

macOS 上的 Raycast 插件，快速检索密码、复制凭据、添加新条目。仅供个人使用，不发布到 Raycast Store。

## 安装

```bash
cd raycast && npm install && npm run dev
```

`npm run dev` 会自动编译并注册到 Raycast。之后在 Raycast 搜索栏输入 "Search Vault" 或 "Add Cipher" 即可使用。

## 配置

首次打开任意命令时，Raycast 会弹出 Preferences 设置面板，需要填写三项：

| 字段 | 说明 | 示例 |
|------|------|------|
| **Server URL** | Vaultflare 后端的**根地址**，不带 `/api` 后缀 | `https://vault.example.com` |
| **Email** | 注册时使用的邮箱 | `user@example.com` |
| **Master Password** | 主密码（Raycast 加密存储，不会明文落盘） | |

### 为什么 Server URL 不带 `/api`？

Vaultflare 的前端和后端共用同一个域名，通过路径前缀区分：

- `your-domain/*` — 前端静态资源（Web Worker）
- `your-domain/api/*` — 后端 API（另一个 Worker）

插件内部已经硬编码了 `/api/auth/login/challenge`、`/api/ciphers` 等路径，会自动拼接到 Server URL 后面。所以只需要填根地址，填成 `https://vault.example.com/api` 反而会导致请求发到 `.../api/api/...`，直接 404。

## 命令

- **Search Vault** — 搜索密码库，选中条目按 Enter 复制密码，也可复制用户名或打开网址
- **Add Cipher** — 填表添加新密码条目

## 已知行为

- **首次打开约 1-2 秒 loading**：Argon2id 密钥派生是 CPU 密集操作，无法跳过。之后会缓存 session token，再次打开时先展示缓存数据、后台静默刷新。
- **Master Password 每次都会参与计算**：CryptoKey 无法序列化存储，每次命令调用都需要重新从密码派生。但如果 token 未过期，可以跳过网络请求（用本地缓存的 salt/params 计算）。
