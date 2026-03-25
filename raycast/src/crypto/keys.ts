// input: argon2.ts 产出的 IKM (Uint8Array)
// output: deriveMasterKey() / deriveAuthKey() — 从 IKM 派生 MasterKey 和 AuthKey
// pos: 密码学链条第二环，被 session.ts 和 vault.ts 依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { webcrypto } from "node:crypto";

const crypto = globalThis.crypto ?? webcrypto;
const ENCODER = new TextEncoder();

/**
 * 将 IKM 导入为 HKDF base key（Web Crypto 要求先 importKey）。
 */
async function importIKM(ikm: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ikm as Uint8Array<ArrayBuffer>, "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);
}

/**
 * 用 HKDF-SHA256 从 IKM 派生一个 AES-GCM-256 CryptoKey。
 *
 * @param ikm   32 字节初始密钥材料
 * @param info  用途标识字符串（"master-key" 或 "auth-key"）
 * @returns CryptoKey (AES-GCM 256-bit, extractable)
 */
async function deriveKey(ikm: Uint8Array, info: string): Promise<CryptoKey> {
  const baseKey = await importIKM(ikm);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0), // 无 salt，通过 info 区分用途
      info: ENCODER.encode(info),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // extractable — AuthKey 需要导出为 raw bytes
    ["encrypt", "decrypt"],
  );
}

/**
 * 派生 MasterKey — 用于加密/解密 DEK，永不离开内存。
 */
export async function deriveMasterKey(ikm: Uint8Array): Promise<CryptoKey> {
  return deriveKey(ikm, "master-key");
}

/**
 * 派生 AuthKey — 导出为 base64 字符串发送到服务器做身份验证。
 */
export async function deriveAuthKey(ikm: Uint8Array): Promise<string> {
  const key = await deriveKey(ikm, "auth-key");
  const raw = await crypto.subtle.exportKey("raw", key);
  return uint8ToBase64(new Uint8Array(raw));
}

// ---- base64 工具 ----

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
