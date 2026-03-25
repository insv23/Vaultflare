# Vaultflare

前后端彻底分离的架构。多个独立项目共享一个 git 仓库，各自独立开发和部署。

## 项目结构

```
Vaultflare/
├── backend/          # Hono + Cloudflare Workers + D1 + Scalar API
├── web/              # 网页端，Cloudflare Workers (不用 Pages，已废弃)
├── raycast/          # Raycast 桌面插件（macOS，个人使用）
└── chrome-extension/ # Chrome 插件
```

**不是 monorepo**，只是把相关项目放在一起方便管理。每个子目录独立运行包管理器安装，没有共享依赖。

## 技术栈

- **后端**: Hono, Cloudflare Workers, Cloudflare D1, Scalar (API 文档)
- **前端**: Cloudflare Workers + Static Assets
- **Raycast**: @raycast/api, Node.js 22, hash-wasm (crypto 层复用 web 端)
- **插件**: Chrome Extension Manifest V3

## 协作方式

后端部署后通过 Scalar 暴露 API 文档，web 和 chrome-extension 根据文档调用 API。

## 常用命令

```bash
# Backend
cd backend && pnpm dev      # 本地开发
cd backend && pnpm run deploy   # 部署到 Cloudflare
cd backend && pnpm cf-typegen  # 生成 Cloudflare 类型
```

## 改动后校验要求

每次改动后端代码后，必须执行以下命令进行类型检查：

```bash
cd backend && pnpm -s tsc --noEmit
```

每次改动web端代码后，必须执行以下命令进行类型检查：

```bash
cd web && pnpm -s tsc -b --noEmit
```

每次改动raycast端代码后，必须执行以下命令进行类型检查：

```bash
cd raycast && npx tsc --noEmit
```


## 开发规范

- 子目录无独立 git，所有提交在根目录进行
- 搜索技术资料时使用英文关键词
- 不主动修改代码，除非明确收到修改指令
- 禁止过度工程化：不为假想的未来扩展牺牲当前可读性

## AI 工作文档/解释说明

1、目录主md(MODULE_REFERENCE.md)强调任何功能、架构、写法更新必须在工作结束后更新相关目录的子文档。

2、每个，我是说每个，每个文件夹中都有一个极简的架构说明（3行以内），下面写下每个文件的名字、地位、功能。文件开头声明：一旦我所属的文件夹有所变化，请更新我。

3、每个文件的开头，写下三行极简注释，文件input（依赖外部的什么）、文件ouput（对外提供什么）、文件pos（在系统局部的地位是什么）。并写下，一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

## 不要猜测库版本和用法

当我们需要一个依赖或者三方库的时候，请你联网搜索最新的版本，适合我们需求的版本和用法。**禁止** 自己在对应的版本控制文件里面随便写一个版本号。**禁止** 猜测三方库用法，**必须** 先搜索相关文档后，得到正确用法。

## Git 约定

### 工作流：先 Issue 再代码

1. **开 Issue**：动手前用 `/issue` 创建设计 Issue，明确目标和方案
2. **写代码**：实现方案，中间 commit 带 `refs #N`
3. **提交**：用 `/ship` 提交代码

### Commit 必须关联 Issue（硬性要求）

- 每次用 `/ship` 提交前，**必须** 检查当前工作是否对应某个 open Issue
- 中间过程的 commit：message 末尾加 `refs #N`
- 完成任务的最终 commit：message 末尾加 `closes #N`
- 如果一次 commit 完成了多个 Issue：`closes #1, closes #2`
- **禁止** 提交与 Issue 相关的代码却不带关联关键词
