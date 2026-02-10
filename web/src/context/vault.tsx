// input: api/client.ts + crypto/vault.ts + context/auth.tsx
// output: VaultProvider + useVault() — 密码库状态管理，暴露 CRUD 操作
// pos: 全局密码库上下文，被 pages/Vault.tsx 消费
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/auth";
import {
  apiFetch,
  type CipherListResponse,
  type CreateCipherResponse,
  type UpdateCipherResponse,
  type DeleteCipherResponse,
} from "@/api/client";
import {
  encryptCipher,
  decryptCipher,
  type CipherData,
} from "@/crypto/vault";

export type { CipherData };

export type DecryptedCipher = {
  cipher_id: string;
  data: CipherData;
  item_version: number;
  created_at: number;
  updated_at: number;
};

type VaultState = {
  ciphers: DecryptedCipher[];
  isLoading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  createCipher: (data: CipherData) => Promise<void>;
  updateCipher: (id: string, data: CipherData, version: number) => Promise<void>;
  deleteCipher: (id: string, version: number) => Promise<void>;
};

const VaultContext = createContext<VaultState | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { masterKey } = useAuth();
  const [ciphers, setCiphers] = useState<DecryptedCipher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!masterKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CipherListResponse>("/api/ciphers", {
        method: "GET",
      });

      // 过滤已删除的，并行解密
      const active = res.ciphers.filter((c) => c.deleted_at === null);
      const decrypted = await Promise.all(
        active.map(async (c) => {
          const data = await decryptCipher(
            masterKey,
            c.encrypted_dek,
            c.encrypted_data,
          );
          return {
            cipher_id: c.cipher_id,
            data,
            item_version: c.item_version,
            created_at: c.created_at,
            updated_at: c.updated_at,
          } satisfies DecryptedCipher;
        }),
      );

      setCiphers(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load vault");
    } finally {
      setIsLoading(false);
    }
  }, [masterKey]);

  // masterKey 可用后自动拉取
  useEffect(() => {
    if (masterKey) fetchAll();
  }, [masterKey, fetchAll]);

  const createCipherFn = useCallback(
    async (data: CipherData) => {
      if (!masterKey) return;
      setIsLoading(true);
      setError(null);
      try {
        const encrypted = await encryptCipher(masterKey, data);
        const res = await apiFetch<CreateCipherResponse>("/api/ciphers", {
          method: "POST",
          body: JSON.stringify(encrypted),
        });

        const newCipher: DecryptedCipher = {
          cipher_id: res.cipher_id,
          data,
          item_version: res.item_version,
          created_at: res.created_at,
          updated_at: res.created_at,
        };
        setCiphers((prev) => [...prev, newCipher]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create cipher");
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [masterKey],
  );

  const updateCipherFn = useCallback(
    async (id: string, data: CipherData, version: number) => {
      if (!masterKey) return;
      setIsLoading(true);
      setError(null);
      try {
        const encrypted = await encryptCipher(masterKey, data);
        const res = await apiFetch<UpdateCipherResponse>(
          `/api/ciphers/${id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              ...encrypted,
              expected_version: version,
            }),
          },
        );

        setCiphers((prev) =>
          prev.map((c) =>
            c.cipher_id === id
              ? {
                  ...c,
                  data,
                  item_version: res.item_version,
                  updated_at: res.updated_at,
                }
              : c,
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update cipher");
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [masterKey],
  );

  const deleteCipherFn = useCallback(
    async (id: string, version: number) => {
      setIsLoading(true);
      setError(null);
      try {
        await apiFetch<DeleteCipherResponse>(
          `/api/ciphers/${id}?expected_version=${version}`,
          { method: "DELETE" },
        );
        setCiphers((prev) => prev.filter((c) => c.cipher_id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete cipher");
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return (
    <VaultContext.Provider
      value={{
        ciphers,
        isLoading,
        error,
        fetchAll,
        createCipher: createCipherFn,
        updateCipher: updateCipherFn,
        deleteCipher: deleteCipherFn,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultState {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
