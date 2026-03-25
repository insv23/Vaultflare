// input: 无外部依赖，纯 fetch 封装
// output: API 请求函数（challenge/verify/ciphers CRUD）+ 类型定义
// pos: 网络层，被 session.ts 和命令文件依赖
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import type { KdfParams } from "./crypto/argon2";

// ---- API 请求/响应类型 ----

export type ChallengeResponse = {
  user_id: string;
  email: string;
  kdf_salt: string;
  kdf_params: { iterations?: number; memory?: number; parallelism?: number };
  vault_version: number;
};

export type VerifyResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_at: number;
  user_id: string;
  vault_version: number;
};

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

export type CipherListResponse = {
  vault_version: number;
  ciphers: CipherItem[];
};

export type CreateCipherResponse = {
  cipher_id: string;
  item_version: number;
  created_at: number;
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

// ---- 错误类型 ----

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

// ---- 通用请求 ----

async function request<T>(
  serverUrl: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${serverUrl.replace(/\/+$/, "")}${path}`;
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = (body as { error?: { code?: string; message?: string } })
      ?.error;
    throw new ApiError(
      res.status,
      error?.code ?? "unknown",
      error?.message ?? `Request failed with status ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ---- API 函数 ----

export async function fetchChallenge(
  serverUrl: string,
  email: string,
): Promise<ChallengeResponse> {
  return request<ChallengeResponse>(serverUrl, "/api/auth/login/challenge", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchVerify(
  serverUrl: string,
  email: string,
  authKey: string,
): Promise<VerifyResponse> {
  return request<VerifyResponse>(serverUrl, "/api/auth/login/verify", {
    method: "POST",
    body: JSON.stringify({ email, auth_key: authKey }),
  });
}

export async function fetchCiphers(
  serverUrl: string,
  token: string,
): Promise<CipherListResponse> {
  return request<CipherListResponse>(serverUrl, "/api/ciphers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createCipher(
  serverUrl: string,
  token: string,
  encryptedData: { encrypted_data: string; encrypted_dek: string },
): Promise<CreateCipherResponse> {
  return request<CreateCipherResponse>(serverUrl, "/api/ciphers", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(encryptedData),
  });
}
