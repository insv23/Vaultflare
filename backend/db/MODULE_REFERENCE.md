# db 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/db` 维护 D1 的初始化与演进基础，当前以 `schema.sql` 作为单一事实来源。

## `schema.sql`

- 职责: 定义后端核心数据模型（`users/ciphers/sessions`）、索引和触发器规则（时间戳更新、版本递增）。
- 输入:
  - 由 `wrangler d1 execute ... --file=./db/schema.sql` 执行。
  - SQL 运行环境为 Cloudflare D1 (SQLite 方言)。
- 输出:
  - 三张核心表与关联约束。
  - 查询优化索引。
  - 自动维护 `updated_at` 和 `vault_version/item_version` 的触发器。
- 依赖:
  - `users` 被 `ciphers/sessions` 外键依赖。
  - `ciphers` 触发器依赖 `users.vault_version` 作为全局版本源。
- 错误处理:
  - 通过 `IF NOT EXISTS` 降低重复执行失败风险。
  - 不包含数据迁移回滚逻辑，结构变更需配套 migration 策略。
- 边界条件:
  - `trg_ciphers_update_bump_versions` 只监听 `encrypted_dek/encrypted_data/deleted_at`，更新其他列不会 bump 版本。
  - 版本与时间戳依赖触发器，若在其他环境禁用触发器会导致 API 同步协议失真。
  - 外键开启依赖 `PRAGMA foreign_keys = ON`，缺失时级联删除不生效。
