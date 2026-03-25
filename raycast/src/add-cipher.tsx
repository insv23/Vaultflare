// input: session.ts (认证) + api.ts (创建条目) + crypto/vault.ts (加密)
// output: Add Cipher 命令 — Raycast Form 视图，添加新密码条目
// pos: 辅助命令，用于快速添加新密码
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  popToRoot,
  Icon,
} from "@raycast/api";
import { getSession } from "./session";
import { createCipher } from "./api";
import { encryptCipher } from "./crypto/vault";
import type { CipherData } from "./crypto/vault";
import { useState } from "react";

type FormValues = {
  name: string;
  username: string;
  password: string;
  uri: string;
  notes: string;
};

export default function AddCipher() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: FormValues) {
    if (!values.name.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Name is required",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await getSession();

      const data: CipherData = {
        name: values.name.trim(),
        ...(values.username && { username: values.username }),
        ...(values.password && { password: values.password }),
        ...(values.uri && { uri: values.uri }),
        ...(values.notes && { notes: values.notes }),
      };

      const encrypted = await encryptCipher(session.masterKey, data);
      await createCipher(session.serverUrl, session.token, encrypted);

      await showToast({
        style: Toast.Style.Success,
        title: "Cipher added",
        message: data.name,
      });
      await popToRoot();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to add cipher",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Add Cipher"
            icon={Icon.Plus}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" placeholder="e.g. GitHub" />
      <Form.TextField
        id="username"
        title="Username"
        placeholder="e.g. user@example.com"
      />
      <Form.PasswordField id="password" title="Password" />
      <Form.TextField
        id="uri"
        title="URL"
        placeholder="e.g. https://github.com"
      />
      <Form.TextArea id="notes" title="Notes" placeholder="Optional notes" />
    </Form>
  );
}
