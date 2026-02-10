// input: 无外部依赖，纯 fetch 封装
// output: apiFetch() 通用请求函数 + API 类型定义 + KDF 参数映射
// pos: API 层基础设施，被 context/auth.tsx 依赖
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
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
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
