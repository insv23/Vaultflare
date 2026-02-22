# context/ — React 全局上下文

一旦我所属的文件夹有所变化，请更新我。

全局状态管理层，Provider 模式，被 pages/ 消费。

| 文件 | 地位 | 功能 |
|------|------|------|
| auth.tsx | 认证上下文 | AuthProvider + useAuth()，管理 token/masterKey/userId/email，暴露 register/login/logout/unlock/changePassword；支持 Lock/Unlock 模式和密码修改（sessionStorage 缓存 token 和 KDF 参数，密钥不落盘） |
| vault.tsx | 密码库上下文 | VaultProvider + useVault()，管理解密后的 ciphers 列表，暴露 fetchAll/createCipher/updateCipher/deleteCipher |
