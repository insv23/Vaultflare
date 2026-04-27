// input: add-cipher.tsx / edit-cipher.tsx (提交逻辑) + @raycast/api (表单 UI)
// output: CipherForm 共享组件 — 统一新增/编辑条目的表单结构
// pos: Raycast 密码条目表单层，被新增命令和编辑子视图复用
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { Form, ActionPanel, Action, Icon } from "@raycast/api";
import type { CipherData } from "./crypto/vault";

export type CipherFormValues = {
  name: string;
  username: string;
  password: string;
  uri: string;
  notes: string;
};

type CipherFormProps = {
  isSubmitting: boolean;
  submitTitle: string;
  submitIcon: Icon;
  navigationTitle?: string;
  initialValues?: Partial<CipherData>;
  enableDrafts?: boolean;
  onSubmit: (values: CipherFormValues) => void | Promise<void>;
};

export default function CipherForm({
  isSubmitting,
  submitTitle,
  submitIcon,
  navigationTitle,
  initialValues,
  enableDrafts,
  onSubmit,
}: CipherFormProps) {
  return (
    <Form
      enableDrafts={enableDrafts}
      isLoading={isSubmitting}
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={submitTitle}
            icon={submitIcon}
            onSubmit={onSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Name"
        placeholder="e.g. GitHub"
        defaultValue={initialValues?.name}
      />
      <Form.TextField
        id="username"
        title="Username"
        placeholder="e.g. user@example.com"
        defaultValue={initialValues?.username ?? ""}
      />
      <Form.TextField
        id="password"
        title="Password"
        placeholder="Paste or type password"
        defaultValue={initialValues?.password ?? ""}
      />
      <Form.TextField
        id="uri"
        title="URL"
        placeholder="e.g. https://github.com"
        defaultValue={initialValues?.uri ?? ""}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        placeholder="Optional notes"
        defaultValue={initialValues?.notes ?? ""}
      />
    </Form>
  );
}
