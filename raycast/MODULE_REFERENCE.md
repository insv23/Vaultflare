# Raycast Extension — MODULE_REFERENCE

> 一旦我所属的文件夹有所变化，请更新我。
> 任何功能、架构、写法更新必须在工作结束后更新此文档。

Raycast 桌面插件，用于快速检索密码、复制凭据、添加新条目。Node.js 22 + React 19 运行时。

## 文件清单

| 文件 | 地位 | 功能 |
|------|------|------|
| `package.json` | 项目配置 | 命令声明、preferences、依赖 |
| `tsconfig.json` | 编译配置 | TypeScript 编译选项 |
| `src/search-vault.tsx` | 主命令 | 搜索密码库 + 复制凭据（List 视图） |
| `src/add-cipher.tsx` | 辅助命令 | 添加新密码条目（Form 视图） |
| `src/api.ts` | 网络层 | API 请求封装 + 类型定义 |
| `src/session.ts` | 认证中枢 | 登录状态管理 + token 缓存 |
| `src/crypto/argon2.ts` | 密码学第一环 | Argon2id 密钥派生（从 web 复制） |
| `src/crypto/keys.ts` | 密码学第二环 | HKDF 派生 MasterKey/AuthKey（从 web 复制） |
| `src/crypto/vault.ts` | 密码学第三环 | AES-256-GCM 加解密（从 web 复制） |

## 子目录文档

- [`src/crypto/FOLDER.md`](src/crypto/FOLDER.md) — crypto 层说明
