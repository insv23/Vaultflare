// input: api/client.ts + crypto/{argon2,keys}
// output: AuthProvider + useAuth() — 认证状态管理，暴露 register/login/logout
// pos: 全局认证上下文，被所有需要认证状态的页面依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { deriveIKM, generateSalt, DEFAULT_KDF_PARAMS } from "@/crypto/argon2";
import { deriveAuthKey, deriveMasterKey, uint8ToBase64, base64ToUint8 } from "@/crypto/keys";
import {
  apiFetch,
  setTokenGetter,
  toKdfParams,
  toApiKdfParams,
  type RegisterResponse,
  type ChallengeResponse,
  type VerifyResponse,
} from "@/api/client";

type AuthState = {
  token: string | null;
  userId: string | null;
  masterKey: CryptoKey | null;
  isLoading: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);

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

      // 存入内存
      tokenRef.current = result.access_token;
      setToken(result.access_token);
      setUserId(result.user_id);
      setMasterKey(mk);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 即使 logout API 失败也清空本地状态
    }
    tokenRef.current = null;
    setToken(null);
    setUserId(null);
    setMasterKey(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, userId, masterKey, isLoading, register, login, logout }}
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
