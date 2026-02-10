# src/ — Vaultflare Web 前端源码

React SPA 密码管理器客户端，零知识架构，所有加密在浏览器完成。
一旦我所属的文件夹有所变化，请更新我。

## 文件/目录清单

| 名称 | 地位 | 功能 |
|------|------|------|
| main.tsx | React 入口 | 挂载 App 到 DOM |
| App.tsx | 根组件 | BrowserRouter + AuthProvider + 路由定义（/login, /register, /vault） |
| index.css | 样式入口 | Tailwind v4 CSS-first 配置 + shadcn 主题 |
| vite-env.d.ts | 类型声明 | Vite 客户端类型引用 |
| api/ | **通信层** | fetch 封装 + API 类型 + KDF 参数映射 |
| context/ | **状态层** | AuthProvider 认证上下文（token/masterKey 仅内存） |
| pages/ | **页面层** | Register / Login / Vault 路由页面 |
| components/ | **UI 组件** | shadcn/ui 基础组件（button, input, label, card） |
| crypto/ | **核心模块** | 客户端密码学：Argon2id → HKDF → AES-GCM |
| lib/ | 工具库 | shadcn/ui 的 cn() 工具函数 |
