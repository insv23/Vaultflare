// input: keys.ts 的 MasterKey (CryptoKey) + base64 工具
// output: encryptCipher() / decryptCipher() — 加密/解密密码条目
// pos: 密码学链条第三环，被 search-vault.tsx 和 add-cipher.tsx 依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { webcrypto } from "node:crypto";
import { uint8ToBase64, base64ToUint8 } from "./keys";

const crypto = globalThis.crypto ?? webcrypto;

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const IV_LENGTH = 12; // AES-GCM 标准 IV 长度

/** 加密前的明文数据结构 */
export type CipherData = {
  name: string; // 唯一必填 — 列表标识符
  username?: string;
  password?: string;
  uri?: string;
  notes?: string;
};

/** 加密后发给服务器的结构 */
export type EncryptedCipher = {
  encrypted_data: string; // base64(IV + ciphertext)
  encrypted_dek: string; // base64(IV + ciphertext)
};

/**
 * 用 AES-256-GCM 加密一段数据。
 * 返回 base64(12字节IV + 密文)。
 */
async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext as Uint8Array<ArrayBuffer>,
  );
  // 拼接 IV + ciphertext
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return uint8ToBase64(combined);
}

/**
 * 用 AES-256-GCM 解密 base64(IV + ciphertext)。
 * 返回明文 Uint8Array。
 */
async function aesGcmDecrypt(
  key: CryptoKey,
  encoded: string,
): Promise<Uint8Array> {
  const combined = base64ToUint8(encoded);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

/**
 * 生成一个随机 AES-256 密钥作为 DEK。
 */
async function generateDEK(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * 将 raw bytes 导入为可用于加密的 AES-GCM 密钥。
 */
async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as Uint8Array<ArrayBuffer>, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * 加密一条密码条目。
 *
 * 流程：
 * 1. 生成随机 DEK
 * 2. DEK 加密 CipherData → encrypted_data
 * 3. MasterKey 加密 DEK → encrypted_dek
 */
export async function encryptCipher(
  masterKey: CryptoKey,
  data: CipherData,
): Promise<EncryptedCipher> {
  const dek = await generateDEK();
  const plaintext = ENCODER.encode(JSON.stringify(data));
  const encrypted_data = await aesGcmEncrypt(dek, plaintext);
  const dekRaw = new Uint8Array(await crypto.subtle.exportKey("raw", dek));
  const encrypted_dek = await aesGcmEncrypt(masterKey, dekRaw);
  return { encrypted_data, encrypted_dek };
}

/**
 * 解密一条密码条目。
 *
 * 流程：
 * 1. MasterKey 解密 encrypted_dek → DEK
 * 2. DEK 解密 encrypted_data → CipherData
 */
export async function decryptCipher(
  masterKey: CryptoKey,
  encrypted_dek: string,
  encrypted_data: string,
): Promise<CipherData> {
  const dekRaw = await aesGcmDecrypt(masterKey, encrypted_dek);
  const dek = await importAesKey(dekRaw);
  const plaintext = await aesGcmDecrypt(dek, encrypted_data);
  return JSON.parse(DECODER.decode(plaintext)) as CipherData;
}
