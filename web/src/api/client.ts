// input: 无外部依赖，纯 fetch 封装
// output: apiFetch() 通用请求函数 + API 类型定义（Auth + Cipher + ChangePassword）+ KDF 参数映射
// pos: API 层基础设施，被 context/auth.tsx 和 context/vault.tsx 依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import type { KdfParams } from "@/crypto/argon2";

// ---- Token 注入 ----

let tokenGetter: (() => string | null) | null = null;

/** 供 AuthProvider 注入 token 获取函数，避免与 context 循环依赖 */
export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

// ---- 错误类型 ----

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

// ---- 通用 fetch ----

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = tokenGetter?.();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = (body as { error?: { code?: string; message?: string } })
      ?.error;
    throw new ApiRequestError(
      res.status,
      error?.code ?? "unknown",
      error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ---- API 请求/响应类型 ----

export type RegisterRequest = {
  email: string;
  auth_key: string;
  kdf_salt: string;
  kdf_params: { iterations?: number; memory?: number; parallelism?: number };
};

export type RegisterResponse = {
  user_id: string;
  email: string;
  vault_version: number;
};

export type ChallengeResponse = {
  user_id: string;
  email: string;
  kdf_salt: string;
  kdf_params: { iterations?: number; memory?: number; parallelism?: number };
  vault_version: number;
};

export type VerifyRequest = {
  email: string;
  auth_key: string;
};

export type VerifyResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_at: number;
  user_id: string;
  vault_version: number;
};

// ---- Change Password 类型 ----

export type ChangePasswordRequest = {
  old_auth_key: string;
  new_auth_key: string;
  new_kdf_salt: string;
  new_kdf_params: { iterations?: number; memory?: number; parallelism?: number };
  deks: Array<{ cipher_id: string; encrypted_dek: string }>;
};

export type ChangePasswordResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_at: number;
  user_id: string;
  vault_version: number;
};

// ---- Cipher API 类型 ----

/** 后端返回的单条 cipher（未解密） */
export type CipherItem = {
  cipher_id: string;
  encrypted_dek: string;
  encrypted_data: string;
  item_version: number;
  vault_version: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

/** GET /api/ciphers 响应 */
export type CipherListResponse = {
  vault_version: number;
  ciphers: CipherItem[];
};

/** POST /api/ciphers 响应 */
export type CreateCipherResponse = {
  cipher_id: string;
  item_version: number;
  created_at: number;
};

/** PUT /api/ciphers/:id 响应 */
export type UpdateCipherResponse = {
  cipher_id: string;
  item_version: number;
  vault_version: number;
  updated_at: number;
};

/** DELETE /api/ciphers/:id 响应 */
export type DeleteCipherResponse = {
  cipher_id: string;
  deleted_at: number;
  item_version: number;
  vault_version: number;
};

// ---- KDF 参数映射 ----

/** 后端 API → hash-wasm（memory → memorySize） */
export function toKdfParams(api: ChallengeResponse["kdf_params"]): KdfParams {
  return {
    iterations: api.iterations ?? 3,
    memorySize: api.memory ?? 65536,
    parallelism: api.parallelism ?? 4,
  };
}

/** hash-wasm → 后端 API（memorySize → memory） */
export function toApiKdfParams(
  params: KdfParams,
): RegisterRequest["kdf_params"] {
  return {
    iterations: params.iterations,
    memory: params.memorySize,
    parallelism: params.parallelism,
  };
}
