# Vaultflare 用户故事（精简版）

> 目标：把“用户在做什么”和“后端代码层发生什么”放在同一张图里，帮助快速统一密码管理器设计思路。

## 术语速查（先看这个）

- `主密码 (Master Password)`：用户自己记住的那串密码，只在本地使用，不上传服务器。
- `KDF`：把“人类可记忆密码”变成“机器可用密钥材料”的过程；这里用 `Argon2id`，故意算得慢，增加暴力破解成本。
- `IKM`：KDF 输出的“初始密钥材料”（可以理解成一块原始钥匙坯）。
- `HKDF`：把一块钥匙坯拆成多把用途不同的钥匙，避免“一把钥匙干所有事”。
- `MasterKey (MK)`：只在客户端，用来加密每条数据用的 DEK，不上传服务器。
- `AuthKey (AK)`：给服务器做身份验证用的密钥材料（不是主密码本身）。
- `DEK`：每条密码数据自己的“数据加密密钥”（Data Encryption Key）。
- `encrypted_data`：用 DEK 加密后的条目密文（服务器可存但看不懂）。
- `encrypted_dek`：用 MK 加密后的 DEK（服务器同样只能存）。
- `vault_version`：用户密码库总版本号；有任何条目变更就递增，用于多端同步。
- `item_version`：单条记录版本号；用于并发冲突检测。
- `soft delete`：软删除；不物理删行，只标 `deleted_at`，方便多端同步删除事件。
- `tombstone`：软删除留下的“墓碑记录”，告诉其他设备“这条已经被删了”。

## 整体设计思路（不懂密码学也能看）

1. **先分清职责**
- 客户端负责“算密钥 + 加解密”。
- 服务端负责“鉴权 + 存密文 + 管版本 + 做同步”。

2. **为什么这样分**
- 就算服务器被拖库，攻击者拿到的也主要是密文和元数据，不是明文密码本。
- 主密码不离开本地，降低服务端泄漏时的直接风险。

3. **核心数据流**
- 登录前：客户端用主密码派生出 AK/MK，服务端只参与认证流程。
- 写入条目：客户端先加密，再上传 `encrypted_data + encrypted_dek`。
- 读取条目：服务端返回密文，客户端本地解密。
- 多端同步：靠 `vault_version/item_version/deleted_at` 判断“哪些变了、有没有冲突、是否已删除”。

4. **你可以用一句话记住**
- `服务端管理状态，客户端掌握秘密`。

## 文档范围

- 仅覆盖 5 个核心流程：注册、登录、创建条目、同步、删除条目。
- 以 `backend/DESIGN.md` 的目标架构为准。
- 当前仓库现状：`backend/src` 目前仅有 `index.ts`，下文中的路由/中间件/数据层为“应落地代码路径”。

## 统一心智模型

- 客户端负责：主密码输入、KDF、加解密、版本号传递。
- 服务端负责：身份校验、密文存储、版本控制、会话管理。
- 服务端永不接触：主密码、明文条目、可直接还原明文的密钥材料。

## 用户故事 1：首次注册

**用户操作**

- 用户输入邮箱和主密码，点击“创建账号”。

**客户端发生**

- 生成 `kdf_salt` 与 `kdf_params`。
- 用主密码做 Argon2id，得到 IKM；再经 HKDF 分离得到 `MasterKey` 和 `AuthKey`。
- 向后端发送：`email`、`auth_key`、`kdf_salt`、`kdf_params`。

**服务端代码层应发生**

- 路由：`POST /api/auth/register`（`backend/src/routes/auth.ts`）。
- 校验：Zod 校验请求体（邮箱格式、参数类型、长度）。
- 数据写入：`users` 表新增记录，初始化 `vault_version = 0`。
- 返回：`201` + `user_id/email/vault_version`。

**数据库变化**

- `users`：新增 1 行。
- `ciphers`、`sessions`：无变化。

## 用户故事 2：登录并建立会话

**用户操作**

- 用户输入邮箱和主密码，点击“登录”。

**客户端发生**

- 先请求 challenge：`POST /api/auth/login/challenge`，拿到该用户 KDF 参数。
- 本地重新派生 `AuthKey`。
- 再调用 `POST /api/auth/login/verify` 提交认证证明。
- 登录成功后保存会话 token（Bearer）。

**服务端代码层应发生**

- 路由：`login/challenge` 查询 `users`，返回 `kdf_salt/kdf_params`。
- 路由：`login/verify` 校验认证材料，成功后创建 `sessions` 记录。
- 中间件：后续请求走 `backend/src/middleware/auth.ts` 校验 Bearer token。

**数据库变化**

- `sessions`：新增 1 行（会话创建时间、过期时间、用户 ID）。
- `users`、`ciphers`：无变化。

## 用户故事 3：新增一个密码条目

**用户操作**

- 用户在客户端新建条目（例如网站账号密码）并点击保存。

**客户端发生**

- 生成随机 DEK。
- 用 DEK 加密明文条目，得到 `encrypted_data`。
- 用 `MasterKey` 加密 DEK，得到 `encrypted_dek`。
- 调用 `POST /api/ciphers` 提交密文与必要元数据。

**服务端代码层应发生**

- 中间件：先鉴权（Bearer -> user_id）。
- 路由：`backend/src/routes/ciphers.ts` 接收并校验密文字段。
- 数据写入：`ciphers` 插入记录，初始 `item_version = 1`。
- 版本推进：对应用户 `vault_version + 1`（触发器或事务内更新）。
- 返回：`201` + `cipher_id/item_version/created_at`。

**数据库变化**

- `ciphers`：新增 1 行密文条目。
- `users`：该用户 `vault_version` 自增。

## 用户故事 4：多端同步（增量）

**用户操作**

- 用户在新设备打开应用并点击“同步”。

**客户端发生**

- 携带本地最新 `vault_version` 请求 `GET /api/ciphers/sync`。
- 拉取服务端“自该版本之后的变更集合”。
- 在本地按 `item_version` 合并并解密展示。

**服务端代码层应发生**

- 中间件：鉴权。
- 路由：按 `user_id + since_version` 查询变更。
- 返回：`vault_version` + 变更条目列表（含软删除 tombstone）。

**数据库变化**

- 读操作，无新增写入（除非单独记录同步审计日志）。

## 用户故事 5：删除条目（软删除）

**用户操作**

- 用户在客户端删除一个条目。

**客户端发生**

- 调用 `DELETE /api/ciphers/:id`，携带 token 与版本信息（如有）。

**服务端代码层应发生**

- 中间件：鉴权并确认资源归属。
- 路由：将 `ciphers.deleted_at` 设为当前时间戳，不做物理删除。
- 版本推进：`item_version + 1`，并使用户 `vault_version + 1`。
- 返回：`200` + `cipher_id/deleted_at`。

**数据库变化**

- `ciphers`：目标行 `deleted_at` 从 `NULL` -> 时间戳。
- `users`：该用户 `vault_version` 自增。

## 关键设计检查点（最小集）

- 注册/登录：必须避免把“可复用认证秘密”直接暴露给重放攻击面。
- 条目写入：所有写操作都要保证 `vault_version` 单调递增。
- 冲突处理：更新/删除需要 `item_version` 语义清晰，409 行为稳定。
- 同步语义：增量同步必须返回 tombstone，否则多端会“复活已删除条目”。
- 日志边界：日志中不得出现主密码、`AuthKey`、密文大字段、Bearer token。

## 建议落地顺序（和用户故事一致）

1. `auth/register` + `login/challenge` + `login/verify` + `sessions`。
2. `POST /api/ciphers`（先打通单端新增）。
3. `DELETE /api/ciphers/:id`（软删除 + 版本推进）。
4. `GET /api/ciphers/sync`（增量 + tombstone）。
5. 最后补 `PUT /api/ciphers/:id` 与冲突策略细节。
