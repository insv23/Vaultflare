// input: hash-wasm 的 argon2id 函数
// output: deriveIKM() — 从主密码+salt派生32字节初始密钥材料
// pos: 密码学链条第一环，被 keys.ts 依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { argon2id } from "hash-wasm";

/** Argon2id 默认参数，对标 OWASP / Bitwarden 推荐值 */
export const DEFAULT_KDF_PARAMS = {
  iterations: 3,
  memorySize: 65536, // 64 MiB
  parallelism: 4,
} as const;

export type KdfParams = {
  iterations: number;
  memorySize: number;
  parallelism: number;
};

/**
 * 用 Argon2id 从主密码派生 32 字节 IKM。
 *
 * @param password  用户主密码（明文字符串）
 * @param salt      16 字节随机盐（Uint8Array）
 * @param params    KDF 参数，默认 {iterations:3, memorySize:65536, parallelism:4}
 * @returns 32 字节 Uint8Array (IKM)
 */
export async function deriveIKM(
  password: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS,
): Promise<Uint8Array> {
  const ikm = await argon2id({
    password,
    salt,
    iterations: params.iterations,
    memorySize: params.memorySize,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
  return ikm;
}

/** 生成 16 字节随机 salt */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}
