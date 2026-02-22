# pages/ — 页面级组件

一旦我所属的文件夹有所变化，请更新我。

每个文件对应一个路由，在 App.tsx 中注册。

| 文件 | 地位 | 功能 |
|------|------|------|
| Register.tsx | /register 路由 | 注册表单，Argon2id 派生密钥后调用注册 API |
| Login.tsx | /login 路由 | 登录表单，两步认证对用户透明 |
| Unlock.tsx | /unlock 路由 | 锁定后快速解锁，只需主密码，无网络请求 |
| Vault.tsx | /vault 路由 | 密码库主页，搜索过滤 + 密码列表 + CRUD 操作 + 独立密码生成器弹窗 |
