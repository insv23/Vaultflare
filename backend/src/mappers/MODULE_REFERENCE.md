# mappers 模块参考

> 一旦我所属的文件夹有所变化，请更新我。

`backend/src/mappers` 专门做“数据库行 -> API 响应对象”的字段转换，隔离命名和类型差异，防止路由层散落重复转换逻辑。

## `cipher.mapper.ts`

- 职责: 把 `ciphers` 表行数据映射为 API 输出结构，统一把 `id` 转成 `cipher_id`，并把数值字段显式转 `number`。
- 输入:
  - 单条 `CipherRow`（含 `item_version/vault_version/deleted_at/created_at/updated_at`）。
  - 或 `CipherRow[]`。
- 输出:
  - `mapCipher`: 单条响应对象。
  - `mapCipherList`: 响应对象数组。
- 依赖: 无外部 IO，纯函数。
- 错误处理:
  - 不做异常捕获，也不做空值兜底（除 `deleted_at` 转 `null` 逻辑）。
  - 输入字段缺失会在调用处暴露问题。
- 边界条件:
  - D1 返回的整数字段可能是字符串或 number，统一 `Number(...)` 避免前端收到不稳定类型。
  - 若未来 API 改字段名，应只改这里，路由层保持透传。
