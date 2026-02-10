# Vaultflare

前后端彻底分离的架构。三个独立项目共享一个 git 仓库，各自独立开发和部署。

## 项目结构

```
Vaultflare/
├── backend/          # Hono + Cloudflare Workers + D1 + Scalar API
├── web/              # 网页端，Cloudflare Workers (不用 Pages，已废弃)
└── chrome-extension/ # Chrome 插件
```

**不是 monorepo**，只是把相关项目放在一起方便管理。每个子目录独立运行 `pnpm install`，没有共享依赖。

## 技术栈

- **后端**: Hono, Cloudflare Workers, Cloudflare D1, Scalar (API 文档)
- **前端**: Cloudflare Workers + Static Assets
- **插件**: Chrome Extension Manifest V3

## 协作方式

后端部署后通过 Scalar 暴露 API 文档，web 和 chrome-extension 根据文档调用 API。

## 常用命令

```bash
# Backend
cd backend && pnpm dev      # 本地开发
cd backend && pnpm deploy   # 部署到 Cloudflare
cd backend && pnpm cf-typegen  # 生成 Cloudflare 类型
```

## 改动后校验要求

每次改动后端代码后，必须执行以下命令进行类型检查：

```bash
cd backend && pnpm -s tsc --noEmit
```

每次改动web端代码后，必须执行以下命令进行类型检查：

```bash
cd web && pnpm -s tsc --noEmit
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

# AI agent principles

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before writing code, first explore the project structure and understand the existing codebase. 

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
