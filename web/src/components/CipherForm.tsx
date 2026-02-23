// input: shadcn Dialog + Input + Textarea + lucide-react + PasswordGeneratorOptions + generate-password + PasswordStrengthBar
// output: CipherForm — 新增/编辑密码条目的 Dialog 表单，仅 name 必填，其余可选，内嵌密码生成器 + 密码强度指示器
// pos: 被 pages/Vault.tsx 调用，统一处理 create 和 edit 场景
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState, useEffect, type FormEvent } from "react";
import { Eye, EyeOff, Dices } from "lucide-react";
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
import PasswordGeneratorOptions from "@/components/PasswordGeneratorOptions";
import { generatePassword, DEFAULT_PASSWORD_OPTIONS, type PasswordOptions } from "@/lib/generate-password";
import PasswordStrengthBar from "@/components/PasswordStrengthBar";

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
  const [showGenerator, setShowGenerator] = useState(false);
  const [genOptions, setGenOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
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
      setShowGenerator(false);
      setGenOptions(DEFAULT_PASSWORD_OPTIONS);
      setError(null);
    }
  }, [open, initialData]);

  function handleGenToggle() {
    if (!showGenerator) {
      // Opening: generate and fill
      const pw = generatePassword(genOptions);
      setPassword(pw);
      setShowPassword(true);
    }
    setShowGenerator(!showGenerator);
  }

  function handleGenOptionsChange(opts: PasswordOptions) {
    setGenOptions(opts);
    const pw = generatePassword(opts);
    setPassword(pw);
    setShowPassword(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const hasContent = username.trim() || password || uri.trim() || notes.trim();
      if (!hasContent) {
        setError("Fill in at least one field (username, password, URI, or notes)");
        setSubmitting(false);
        return;
      }
      const data: CipherData = {
        name: name.trim(),
        ...(username.trim() && { username: username.trim() }),
        ...(password && { password }),
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

        <form onSubmit={handleSubmit} autoComplete="off" className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cf-1">Name</Label>
            <Input id="cf-1" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-2">Username</Label>
            <Input id="cf-2" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-3">Password</Label>
            <div className="relative">
              <Input
                id="cf-3"
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-20"
              />
              <div className="absolute right-0 top-0 flex h-full">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleGenToggle}
                  tabIndex={-1}
                  title="Generate password"
                >
                  <Dices className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <PasswordStrengthBar password={password} />
            {showGenerator && (
              <PasswordGeneratorOptions options={genOptions} onChange={handleGenOptionsChange} />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-4">URI</Label>
            <Input id="cf-4" autoComplete="off" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cf-5">Notes</Label>
            <Textarea id="cf-5" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
