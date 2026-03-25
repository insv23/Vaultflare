// input: session.ts (认证) + api.ts (更新条目) + crypto/vault.ts (加密)
// output: EditCipher 组件 — Raycast Form 视图，编辑已有密码条目
// pos: 被 search-vault.tsx 通过 Action.Push 调用的子视图
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
import { updateCipher } from "./api";
import { encryptCipher } from "./crypto/vault";
import type { CipherData } from "./crypto/vault";
import { useState } from "react";

export type EditCipherProps = {
  cipherId: string;
  itemVersion: number;
  data: CipherData;
  onEdited: () => void;
};

type FormValues = {
  name: string;
  username: string;
  password: string;
  uri: string;
  notes: string;
};

export default function EditCipher({
  cipherId,
  itemVersion,
  data,
  onEdited,
}: EditCipherProps) {
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

      const newData: CipherData = {
        name: values.name.trim(),
        ...(values.username && { username: values.username }),
        ...(values.password && { password: values.password }),
        ...(values.uri && { uri: values.uri }),
        ...(values.notes && { notes: values.notes }),
      };

      const encrypted = await encryptCipher(session.masterKey, newData);
      await updateCipher(session.serverUrl, session.token, cipherId, {
        ...encrypted,
        expected_version: itemVersion,
      });

      await showToast({
        style: Toast.Style.Success,
        title: "Cipher updated",
        message: newData.name,
      });
      onEdited();
      await popToRoot();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update cipher",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle={`Edit: ${data.name}`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Changes"
            icon={Icon.Check}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" defaultValue={data.name} />
      <Form.TextField
        id="username"
        title="Username"
        defaultValue={data.username ?? ""}
      />
      <Form.PasswordField
        id="password"
        title="Password"
        defaultValue={data.password ?? ""}
      />
      <Form.TextField
        id="uri"
        title="URL"
        defaultValue={data.uri ?? ""}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        defaultValue={data.notes ?? ""}
      />
    </Form>
  );
}
