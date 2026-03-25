// input: api.ts (网络请求) + crypto/* (密钥派生) + Raycast API (preferences, LocalStorage)
// output: getSession() / clearSession() — 管理登录状态和密钥缓存
// pos: 认证中枢，被所有命令文件依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { deriveIKM } from "./crypto/argon2";
import { deriveMasterKey, deriveAuthKey } from "./crypto/keys";
import { base64ToUint8 } from "./crypto/keys";
import { fetchChallenge, fetchVerify, toKdfParams } from "./api";
import type { KdfParams } from "./crypto/argon2";

type Preferences = {
  serverUrl: string;
  email: string;
  masterPassword: string;
};

export type Session = {
  token: string;
  masterKey: CryptoKey;
  serverUrl: string;
};

// 缓存 key 常量
const CACHE_TOKEN = "session_token";
const CACHE_EXPIRES = "session_expires_at";
const CACHE_KDF_SALT = "session_kdf_salt";
const CACHE_KDF_PARAMS = "session_kdf_params";

/**
 * 获取有效 session。
 *
 * 流程：
 * 1. 检查 LocalStorage 中缓存的 token 是否过期
 * 2. 未过期 → 用缓存的 salt/params 本地派生 MasterKey（跳过网络请求，但 Argon2id 仍需 1-2s）
 * 3. 已过期 → 完整登录流程（challenge → Argon2id → HKDF → verify）
 */
export async function getSession(): Promise<Session> {
  const prefs = getPreferenceValues<Preferences>();
  const { serverUrl, email, masterPassword } = prefs;

  // 检查缓存的 token
  const [cachedToken, cachedExpires, cachedSalt, cachedParams] =
    await Promise.all([
      LocalStorage.getItem<string>(CACHE_TOKEN),
      LocalStorage.getItem<string>(CACHE_EXPIRES),
      LocalStorage.getItem<string>(CACHE_KDF_SALT),
      LocalStorage.getItem<string>(CACHE_KDF_PARAMS),
    ]);

  const now = Math.floor(Date.now() / 1000);
  const isValid =
    cachedToken &&
    cachedExpires &&
    cachedSalt &&
    cachedParams &&
    Number(cachedExpires) > now + 60; // 提前 60s 视为过期

  if (isValid) {
    // token 有效，只需本地派生 MasterKey（不走网络）
    const salt = base64ToUint8(cachedSalt);
    const kdfParams: KdfParams = JSON.parse(cachedParams);
    const ikm = await deriveIKM(masterPassword, salt, kdfParams);
    const masterKey = await deriveMasterKey(ikm);
    return { token: cachedToken, masterKey, serverUrl };
  }

  // token 过期或无缓存，走完整登录流程
  return fullLogin(serverUrl, email, masterPassword);
}

/**
 * 完整登录流程：challenge → Argon2id → HKDF → verify → 缓存
 */
async function fullLogin(
  serverUrl: string,
  email: string,
  masterPassword: string,
): Promise<Session> {
  // 1. 获取 challenge（salt + kdf params）
  const challenge = await fetchChallenge(serverUrl, email);
  const salt = base64ToUint8(challenge.kdf_salt);
  const kdfParams = toKdfParams(challenge.kdf_params);

  // 2. Argon2id 派生 IKM（耗时 1-2s）
  const ikm = await deriveIKM(masterPassword, salt, kdfParams);

  // 3. HKDF 派生 MasterKey + AuthKey
  const [masterKey, authKey] = await Promise.all([
    deriveMasterKey(ikm),
    deriveAuthKey(ikm),
  ]);

  // 4. 验证身份
  const verify = await fetchVerify(serverUrl, email, authKey);

  // 5. 缓存到 LocalStorage
  await Promise.all([
    LocalStorage.setItem(CACHE_TOKEN, verify.access_token),
    LocalStorage.setItem(CACHE_EXPIRES, String(verify.expires_at)),
    LocalStorage.setItem(CACHE_KDF_SALT, challenge.kdf_salt),
    LocalStorage.setItem(CACHE_KDF_PARAMS, JSON.stringify(kdfParams)),
  ]);

  return { token: verify.access_token, masterKey, serverUrl };
}

/**
 * 清除 session 缓存（用于登出或错误恢复）。
 */
export async function clearSession(): Promise<void> {
  await Promise.all([
    LocalStorage.removeItem(CACHE_TOKEN),
    LocalStorage.removeItem(CACHE_EXPIRES),
    LocalStorage.removeItem(CACHE_KDF_SALT),
    LocalStorage.removeItem(CACHE_KDF_PARAMS),
  ]);
}
