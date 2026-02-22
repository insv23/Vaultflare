// input: api/client.ts + crypto/{argon2,keys,vault}
// output: AuthProvider + useAuth() — 认证状态管理，暴露 register/login/logout/unlock/changePassword
// pos: 全局认证上下文，被所有需要认证状态的页面依赖；支持 Lock/Unlock 模式和密码修改
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deriveIKM,
  generateSalt,
  DEFAULT_KDF_PARAMS,
  type KdfParams,
} from "@/crypto/argon2";
import {
  deriveAuthKey,
  deriveMasterKey,
  uint8ToBase64,
  base64ToUint8,
} from "@/crypto/keys";
import {
  apiFetch,
  setTokenGetter,
  toKdfParams,
  toApiKdfParams,
  type RegisterResponse,
  type ChallengeResponse,
  type VerifyResponse,
  type ChangePasswordResponse,
  type CipherListResponse,
} from "@/api/client";
import { reEncryptDeks } from "@/crypto/vault";

// ---- sessionStorage 会话缓存 ----

const SS_TOKEN = "vf_token";
const SS_USER_ID = "vf_user_id";
const SS_EMAIL = "vf_email";
const SS_KDF_SALT = "vf_kdf_salt";
const SS_KDF_PARAMS = "vf_kdf_params";
const SS_VERIFY = "vf_verify";

function ssGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function ssSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function ssClearAll() {
  for (const key of [
    SS_TOKEN,
    SS_USER_ID,
    SS_EMAIL,
    SS_KDF_SALT,
    SS_KDF_PARAMS,
    SS_VERIFY,
  ]) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/** 用 masterKey 加密已知字符串，unlock 时用来验证密码正确性 */
async function encryptVerifier(key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode("vaultflare-verify");
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt),
  );
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv);
  blob.set(ct, iv.length);
  return uint8ToBase64(blob);
}

/** 尝试用 masterKey 解密验证器，返回密码是否正确 */
async function checkVerifier(key: CryptoKey, blob: string): Promise<boolean> {
  try {
    const bytes = base64ToUint8(blob);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt) === "vaultflare-verify";
  } catch {
    return false;
  }
}

type AuthState = {
  token: string | null;
  userId: string | null;
  email: string | null;
  masterKey: CryptoKey | null;
  isLocked: boolean;
  isLoading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 从 sessionStorage 恢复 token/userId（masterKey 无法恢复 → locked 状态）
  const [token, setToken] = useState<string | null>(() => ssGet(SS_TOKEN));
  const [userId, setUserId] = useState<string | null>(() => ssGet(SS_USER_ID));
  const [email, setEmail] = useState<string | null>(() => ssGet(SS_EMAIL));
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef<string | null>(ssGet(SS_TOKEN));

  const isLocked = token !== null && masterKey === null;

  // 连接 api/client 的 token 获取
  setTokenGetter(() => tokenRef.current);

  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const salt = generateSalt();
      const ikm = await deriveIKM(password, salt, DEFAULT_KDF_PARAMS);
      const authKey = await deriveAuthKey(ikm);

      await apiFetch<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          auth_key: authKey,
          kdf_salt: uint8ToBase64(salt),
          kdf_params: toApiKdfParams(DEFAULT_KDF_PARAMS),
        }),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Step 1: challenge — 获取 salt 和 KDF 参数
      const challenge = await apiFetch<ChallengeResponse>(
        "/api/auth/login/challenge",
        {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail }),
        },
      );

      // Step 2: 用服务端返回的 salt/params 派生密钥
      const salt = base64ToUint8(challenge.kdf_salt);
      const kdfParams = toKdfParams(challenge.kdf_params);
      const ikm = await deriveIKM(password, salt, kdfParams);
      const [authKey, mk] = await Promise.all([
        deriveAuthKey(ikm),
        deriveMasterKey(ikm),
      ]);

      // Step 3: verify — 发送 authKey 换 token
      const result = await apiFetch<VerifyResponse>(
        "/api/auth/login/verify",
        {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            auth_key: authKey,
          }),
        },
      );

      // Step 4: 缓存会话数据到 sessionStorage（密钥不落盘）
      ssSet(SS_TOKEN, result.access_token);
      ssSet(SS_USER_ID, result.user_id);
      ssSet(SS_EMAIL, normalizedEmail);
      ssSet(SS_KDF_SALT, challenge.kdf_salt);
      ssSet(SS_KDF_PARAMS, JSON.stringify(kdfParams));
      ssSet(SS_VERIFY, await encryptVerifier(mk));

      // 存入内存
      tokenRef.current = result.access_token;
      setToken(result.access_token);
      setUserId(result.user_id);
      setEmail(normalizedEmail);
      setMasterKey(mk);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    setIsLoading(true);
    try {
      const saltB64 = ssGet(SS_KDF_SALT);
      const paramsJson = ssGet(SS_KDF_PARAMS);
      const verifier = ssGet(SS_VERIFY);
      if (!saltB64 || !paramsJson || !verifier) {
        // 缓存数据缺失，回退到完整登录
        ssClearAll();
        tokenRef.current = null;
        setToken(null);
        setUserId(null);
        setEmail(null);
        setMasterKey(null);
        throw new Error("Session expired, please sign in again");
      }

      const salt = base64ToUint8(saltB64);
      const kdfParams = JSON.parse(paramsJson) as KdfParams;
      const ikm = await deriveIKM(password, salt, kdfParams);
      const mk = await deriveMasterKey(ikm);

      // 验证密码正确性（AES-GCM 认证标签不匹配 → 密码错误）
      const valid = await checkVerifier(mk, verifier);
      if (!valid) {
        throw new Error("Invalid password");
      }

      setMasterKey(mk);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      if (!masterKey) throw new Error("Vault is locked");
      setIsLoading(true);
      try {
        // 1. 用旧密码 + 缓存的 salt/params 派生 oldAuthKey
        const oldSaltB64 = ssGet(SS_KDF_SALT);
        const oldParamsJson = ssGet(SS_KDF_PARAMS);
        if (!oldSaltB64 || !oldParamsJson) {
          throw new Error("Session expired, please sign in again");
        }
        const oldSalt = base64ToUint8(oldSaltB64);
        const oldKdfParams = JSON.parse(oldParamsJson) as KdfParams;
        const oldIkm = await deriveIKM(oldPassword, oldSalt, oldKdfParams);
        const oldAuthKey = await deriveAuthKey(oldIkm);

        // 2. 新密码：生成新 salt，用 DEFAULT_KDF_PARAMS 派生
        const newSalt = generateSalt();
        const newIkm = await deriveIKM(newPassword, newSalt, DEFAULT_KDF_PARAMS);
        const [newAuthKey, newMk] = await Promise.all([
          deriveAuthKey(newIkm),
          deriveMasterKey(newIkm),
        ]);

        // 3. 拉取最新密文列表
        const { ciphers } = await apiFetch<CipherListResponse>("/api/ciphers");

        // 4. 重新加密所有 DEK
        const deks = await reEncryptDeks(
          masterKey,
          newMk,
          ciphers.map((c) => ({
            cipher_id: c.cipher_id,
            encrypted_dek: c.encrypted_dek,
          })),
        );

        // 5. 发送到服务端
        const result = await apiFetch<ChangePasswordResponse>(
          "/api/auth/password",
          {
            method: "PUT",
            body: JSON.stringify({
              old_auth_key: oldAuthKey,
              new_auth_key: newAuthKey,
              new_kdf_salt: uint8ToBase64(newSalt),
              new_kdf_params: toApiKdfParams(DEFAULT_KDF_PARAMS),
              deks,
            }),
          },
        );

        // 6. 更新 sessionStorage + React state
        ssSet(SS_TOKEN, result.access_token);
        ssSet(SS_KDF_SALT, uint8ToBase64(newSalt));
        ssSet(SS_KDF_PARAMS, JSON.stringify(DEFAULT_KDF_PARAMS));
        ssSet(SS_VERIFY, await encryptVerifier(newMk));

        tokenRef.current = result.access_token;
        setToken(result.access_token);
        setMasterKey(newMk);
      } finally {
        setIsLoading(false);
      }
    },
    [masterKey],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 即使 logout API 失败也清空本地状态
    }
    ssClearAll();
    tokenRef.current = null;
    setToken(null);
    setUserId(null);
    setEmail(null);
    setMasterKey(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        email,
        masterKey,
        isLocked,
        isLoading,
        register,
        login,
        logout,
        unlock,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
