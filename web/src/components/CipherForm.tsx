// input: shadcn Dialog + Input + Textarea + lucide-react
// output: CipherForm — 新增/编辑密码条目的 Dialog 表单
// pos: 被 pages/Vault.tsx 调用，统一处理 create 和 edit 场景
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CipherData } from "@/context/vault";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CipherData) => Promise<void>;
  initialData?: CipherData;
};

export default function CipherForm({ open, onClose, onSubmit, initialData }: Props) {
  const isEdit = !!initialData;
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 每次打开时重置表单
  useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setUsername(initialData?.username ?? "");
      setPassword(initialData?.password ?? "");
      setUri(initialData?.uri ?? "");
      setNotes(initialData?.notes ?? "");
      setShowPassword(false);
      setError(null);
    }
  }, [open, initialData]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data: CipherData = {
        name: name.trim(),
        username: username.trim(),
        password,
        ...(uri.trim() && { uri: uri.trim() }),
        ...(notes.trim() && { notes: notes.trim() }),
      };
      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Password" : "Add Password"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cf-name">Name</Label>
            <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-username">Username</Label>
            <Input id="cf-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-password">Password</Label>
            <div className="relative">
              <Input
                id="cf-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-uri">URI</Label>
            <Input id="cf-uri" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-notes">Notes</Label>
            <Textarea id="cf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
