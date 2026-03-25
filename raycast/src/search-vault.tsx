// input: session.ts (认证) + api.ts (获取列表) + crypto/vault.ts (解密)
// output: Search Vault 命令 — Raycast List 视图，搜索并复制密码
// pos: 主命令，用户最常用的入口
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getSession, clearSession } from "./session";
import { fetchCiphers } from "./api";
import { decryptCipher } from "./crypto/vault";
import type { CipherData } from "./crypto/vault";

type DecryptedCipher = {
  cipher_id: string;
  data: CipherData;
};

/** 从 URI 提取 hostname 用于显示 */
function hostname(uri?: string): string {
  if (!uri) return "";
  try {
    return new URL(uri).hostname;
  } catch {
    return uri;
  }
}

async function loadVault(): Promise<DecryptedCipher[]> {
  const session = await getSession();
  const res = await fetchCiphers(session.serverUrl, session.token);

  // 只解密未删除的条目
  const active = res.ciphers.filter((c) => c.deleted_at === null);

  const decrypted = await Promise.all(
    active.map(async (cipher) => {
      const data = await decryptCipher(
        session.masterKey,
        cipher.encrypted_dek,
        cipher.encrypted_data,
      );
      return { cipher_id: cipher.cipher_id, data };
    }),
  );

  return decrypted;
}

export default function SearchVault() {
  const { data, isLoading, revalidate, error } = useCachedPromise(loadVault, [], {
    keepPreviousData: true,
    onError: async (err) => {
      // token 过期等认证错误，清除缓存后重试
      if (err instanceof Error && err.message.includes("401")) {
        await clearSession();
      }
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load vault",
        message: err instanceof Error ? err.message : String(err),
      });
    },
  });

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search vault...">
      {error && !data && (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="Failed to load vault"
          description={error.message}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={revalidate} />
            </ActionPanel>
          }
        />
      )}
      {data?.map((cipher) => (
        <List.Item
          key={cipher.cipher_id}
          icon={Icon.Key}
          title={cipher.data.name}
          subtitle={cipher.data.username ?? ""}
          accessories={[{ text: hostname(cipher.data.uri) }]}
          keywords={[
            cipher.data.username ?? "",
            hostname(cipher.data.uri),
          ].filter(Boolean)}
          actions={
            <ActionPanel>
              {cipher.data.password && (
                <Action.CopyToClipboard
                  title="Copy Password"
                  content={cipher.data.password}
                  concealed
                />
              )}
              {cipher.data.username && (
                <Action.CopyToClipboard
                  title="Copy Username"
                  content={cipher.data.username}
                />
              )}
              {cipher.data.uri && (
                <Action.OpenInBrowser url={cipher.data.uri} />
              )}
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={revalidate}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
