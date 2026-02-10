# pages/ — 页面级组件

一旦我所属的文件夹有所变化，请更新我。

每个文件对应一个路由，在 App.tsx 中注册。

| 文件 | 地位 | 功能 |
|------|------|------|
| Register.tsx | /register 路由 | 注册表单，Argon2id 派生密钥后调用注册 API |
| Login.tsx | /login 路由 | 登录表单，两步认证对用户透明 |
| Vault.tsx | /vault 路由 | 占位页，显示 userId + 登出按钮（Phase 3 实现） |
