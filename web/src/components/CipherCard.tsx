// input: context/vault.tsx (DecryptedCipher 类型) + lucide-react 图标
// output: CipherCard — 单条密码条目展示卡片，提供 copy/edit/delete 操作
// pos: Vault 页面列表的基础单元，被 pages/Vault.tsx 渲染
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState } from "react";
import { Copy, Check, Pencil, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DecryptedCipher } from "@/context/vault";

type Props = {
  cipher: DecryptedCipher;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CipherCard({ cipher, onEdit, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const { data } = cipher;

  async function handleCopy() {
    await navigator.clipboard.writeText(data.password);
    setCopied(true);
    setTimeout(async () => {
      setCopied(false);
      await navigator.clipboard.writeText("").catch(() => {});
    }, 3000);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-card-foreground">{data.name}</p>
        <p className="truncate text-sm text-muted-foreground">{data.username}</p>
        {data.uri && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0" />
            {data.uri}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy password">
          {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
