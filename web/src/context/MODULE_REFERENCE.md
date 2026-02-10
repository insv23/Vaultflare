# context/ — React 全局上下文

一旦我所属的文件夹有所变化，请更新我。

全局状态管理层，Provider 模式，被 pages/ 消费。

| 文件 | 地位 | 功能 |
|------|------|------|
| auth.tsx | 认证上下文 | AuthProvider + useAuth()，管理 token/masterKey/userId，暴露 register/login/logout |
| vault.tsx | 密码库上下文 | VaultProvider + useVault()，管理解密后的 ciphers 列表，暴露 fetchAll/createCipher/updateCipher/deleteCipher |
