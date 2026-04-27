// input: session.ts (认证) + api.ts (创建条目) + crypto/vault.ts (加密)
// output: Add Cipher 命令 — Raycast Form 视图，添加新密码条目
// pos: 辅助命令，用于快速添加新密码
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import {
  showToast,
  Toast,
  popToRoot,
  Icon,
  type LaunchProps,
} from "@raycast/api";
import { withSessionRetry } from "./session";
import { createCipher } from "./api";
import { encryptCipher } from "./crypto/vault";
import type { CipherData } from "./crypto/vault";
import { useState } from "react";
import CipherForm, { type CipherFormValues } from "./cipher-form";

export default function AddCipher({
  draftValues,
}: LaunchProps<{ draftValues: CipherFormValues }>) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: CipherFormValues) {
    if (!values.name.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Name is required",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const data: CipherData = {
        name: values.name.trim(),
        ...(values.username && { username: values.username }),
        ...(values.password && { password: values.password }),
        ...(values.uri && { uri: values.uri }),
        ...(values.notes && { notes: values.notes }),
      };

      await withSessionRetry(async (session) => {
        const encrypted = await encryptCipher(session.masterKey, data);
        await createCipher(session.serverUrl, session.token, encrypted);
      });

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
    <CipherForm
      enableDrafts
      isSubmitting={isSubmitting}
      submitTitle="Add Cipher"
      submitIcon={Icon.Plus}
      initialValues={draftValues}
      onSubmit={handleSubmit}
    />
  );
}
