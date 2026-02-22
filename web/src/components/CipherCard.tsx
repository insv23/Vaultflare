// input: context/vault.tsx (DecryptedCipher) + lucide-react 图标 + shadcn Button + sonner toast
// output: CipherCard — 彩色首字母头像 + 字段行布局，每行独立操作按钮（copy+toast/eye/外链）
// pos: Vault 页面列表的基础单元，被 pages/Vault.tsx 渲染
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState } from "react";
import {
  Copy,
  Check,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DecryptedCipher } from "@/context/vault";

type Props = {
  cipher: DecryptedCipher;
  onEdit: () => void;
  onDelete: () => void;
};

function nameToHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

export default function CipherCard({ cipher, onEdit, onDelete }: Props) {
  const [copiedField, setCopiedField] = useState<"username" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { data } = cipher;

  const hasFields = data.username || data.password || data.uri || data.notes;
  const hue = nameToHue(data.name);

  async function handleCopy(text: string, field: "username" | "password") {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
    setCopiedField(field);
    setTimeout(async () => {
      setCopiedField(null);
      await navigator.clipboard.writeText("").catch(() => {});
    }, 3000);
  }

  function openUri(uri: string) {
    const url = uri.startsWith("http") ? uri : `https://${uri}`;
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg font-bold text-white"
          style={{ backgroundColor: `oklch(0.65 0.15 ${hue})` }}
        >
          {data.name.charAt(0).toUpperCase()}
        </div>
        <p className="min-w-0 flex-1 truncate text-base font-semibold">{data.name}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit">
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onDelete} title="Delete">
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>

      {/* Separator */}
      {hasFields && <div className="my-3 border-t" />}

      {/* Field Rows */}
      {hasFields && (
        <div className="min-w-0 space-y-1.5">
          {data.username && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">user</span>
              <span className="min-w-0 flex-1 truncate text-sm">{data.username}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCopy(data.username!, "username")}
                title="Copy username"
              >
                {copiedField === "username" ? <Check className="text-green-500" /> : <Copy />}
              </Button>
            </div>
          )}

          {data.password && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">pass</span>
              <span className="min-w-0 flex-1 truncate font-mono text-sm tracking-wider">
                {showPassword ? data.password : "••••••••"}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCopy(data.password!, "password")}
                title="Copy password"
              >
                {copiedField === "password" ? <Check className="text-green-500" /> : <Copy />}
              </Button>
            </div>
          )}

          {data.uri && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">url</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {data.uri}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => openUri(data.uri!)}
                title="Open link"
              >
                <ExternalLink />
              </Button>
            </div>
          )}

          {data.notes && (
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-muted-foreground">notes</span>
              <span className="min-w-0 flex-1 truncate text-sm italic text-muted-foreground">
                {data.notes}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
