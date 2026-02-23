// input: context/auth.tsx + shadcn UI 组件 + react-router + ThemeToggle
// output: 解锁页面组件（含右上角主题切换）
// pos: Vault 锁定后的快速解锁入口，只需输入主密码
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";

export default function Unlock() {
  const { token, isLocked, email, unlock, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 无 token → 完整登录；已解锁 → 直接进 vault
  if (!token) return <Navigate to="/login" replace />;
  if (!isLocked) return <Navigate to="/vault" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await unlock(password);
      navigate("/vault");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Vault Locked</CardTitle>
          <CardDescription>
            {email
              ? `Signed in as ${email}. Enter your master password to unlock.`
              : "Enter your master password to unlock your vault."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Deriving keys..." : "Unlock"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={handleLogout}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Sign out and use a different account
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
