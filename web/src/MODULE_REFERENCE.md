# src/ — Vaultflare Web 前端源码

React SPA 密码管理器客户端，零知识架构，所有加密在浏览器完成。
一旦我所属的文件夹有所变化，请更新我。

## 文件/目录清单

| 名称 | 地位 | 功能 |
|------|------|------|
| main.tsx | React 入口 | 挂载 App 到 DOM |
| App.tsx | 根组件 | 路由定义 + 全局 Layout |
| index.css | 样式入口 | Tailwind v4 CSS-first 配置 + shadcn 主题 |
| vite-env.d.ts | 类型声明 | Vite 客户端类型引用 |
| crypto/ | **核心模块** | 客户端密码学：Argon2id → HKDF → AES-GCM |
| lib/ | 工具库 | shadcn/ui 的 cn() 工具函数 |
