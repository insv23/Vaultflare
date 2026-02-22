// input: context/auth.tsx + context/vault.tsx + CipherCard + CipherForm + ChangePasswordForm + PasswordGeneratorOptions + shadcn Dialog + sonner toast
// output: Vault 主页 — 密码列表、搜索、CRUD 操作（带 toast 反馈）、删除确认、独立密码生成器弹窗、修改主密码弹窗
// pos: /vault 路由，登录后落地页，密码库的核心交互界面
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState, useCallback } from "react";
import { Plus, LogOut, Search, Loader2, Dices, Copy, Check, RefreshCw, KeyRound } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useVault, type DecryptedCipher, type CipherData } from "@/context/vault";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CipherCard from "@/components/CipherCard";
import CipherForm from "@/components/CipherForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import PasswordGeneratorOptions from "@/components/PasswordGeneratorOptions";
import { generatePassword, DEFAULT_PASSWORD_OPTIONS, type PasswordOptions } from "@/lib/generate-password";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Vault() {
  const { logout } = useAuth();
  const { ciphers, isLoading, error, createCipher, updateCipher, deleteCipher } = useVault();

  const [searchQuery, setSearchQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCipher, setEditingCipher] = useState<DecryptedCipher | null>(null);
  const [deletingCipher, setDeletingCipher] = useState<DecryptedCipher | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Change Password Dialog
  const [changePwOpen, setChangePwOpen] = useState(false);

  // Password Generator Dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genOptions, setGenOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [genPassword, setGenPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const regenerate = useCallback((opts: PasswordOptions) => {
    setGenPassword(generatePassword(opts));
  }, []);

  function handleGenOpen() {
    const opts = { ...DEFAULT_PASSWORD_OPTIONS };
    setGenOptions(opts);
    setGenPassword(generatePassword(opts));
    setCopied(false);
    setGenOpen(true);
  }

  function handleGenOptionsChange(opts: PasswordOptions) {
    setGenOptions(opts);
    regenerate(opts);
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(genPassword);
    toast("Copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 前端搜索过滤（大小写不敏感，加权排序）
  const query = searchQuery.toLowerCase();
  const filtered = query
    ? ciphers
        .map((c) => {
          let score = 0;
          if (c.data.name.toLowerCase().includes(query)) score += 4;
          if (c.data.uri?.toLowerCase().includes(query)) score += 3;
          if (c.data.username?.toLowerCase().includes(query)) score += 2;
          if (c.data.notes?.toLowerCase().includes(query)) score += 1;
          return { cipher: c, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.cipher)
    : ciphers;

  function handleAdd() {
    setEditingCipher(null);
    setFormOpen(true);
  }

  function handleEdit(cipher: DecryptedCipher) {
    setEditingCipher(cipher);
    setFormOpen(true);
  }

  async function handleFormSubmit(data: CipherData) {
    if (editingCipher) {
      await updateCipher(editingCipher.cipher_id, data, editingCipher.item_version);
      toast.success("Password updated");
    } else {
      await createCipher(data);
      toast.success("Password created");
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingCipher) return;
    setDeleteLoading(true);
    try {
      await deleteCipher(deletingCipher.cipher_id, deletingCipher.item_version);
      setDeletingCipher(null);
      toast.success("Password deleted");
    } catch {
      // error 已由 vault context 设置
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vault</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleGenOpen} title="Password generator">
            <Dices className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setChangePwOpen(true)} title="Change password">
            <KeyRound className="size-4" />
          </Button>
          <Button size="icon" onClick={handleAdd} title="Add password">
            <Plus className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vault..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* List */}
      {isLoading && ciphers.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">
          {searchQuery ? "No results found" : "No passwords yet"}
        </p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <CipherCard
              key={c.cipher_id}
              cipher={c}
              onEdit={() => handleEdit(c)}
              onDelete={() => setDeletingCipher(c)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      <CipherForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={editingCipher?.data}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deletingCipher} onOpenChange={(v) => !v && setDeletingCipher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Password</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingCipher?.data.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingCipher(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Generator */}
      <Dialog open={genOpen} onOpenChange={(v) => !v && setGenOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Generator</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-sm break-all select-all">
              {genPassword}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { regenerate(genOptions); setCopied(false); }}
              title="Regenerate"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              title="Copy"
            >
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <PasswordGeneratorOptions options={genOptions} onChange={handleGenOptionsChange} />
        </DialogContent>
      </Dialog>

      {/* Change Password */}
      <ChangePasswordForm open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </div>
  );
}
