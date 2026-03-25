# crypto/ — 密码学层

> 一旦我所属的文件夹有所变化，请更新我。

从 `web/src/crypto/` 复制而来，逻辑零改动。依赖 hash-wasm (Argon2id) + Web Crypto API (HKDF/AES-GCM)。

| 文件 | 地位 | 功能 |
|------|------|------|
| `argon2.ts` | 第一环 | Argon2id 从主密码+salt 派生 IKM |
| `keys.ts` | 第二环 | HKDF 从 IKM 派生 MasterKey + AuthKey |
| `vault.ts` | 第三环 | AES-256-GCM 加密/解密密码条目 |
