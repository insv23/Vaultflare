// input: context/auth.tsx
// output: Vault 占位页（Phase 3 实现）
// pos: 登录后落地页，展示 userId + 登出按钮
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";

export default function Vault() {
  const { userId, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <h1 className="text-2xl font-bold">Vault</h1>
      <p className="text-muted-foreground text-sm">Signed in as {userId}</p>
      <Button variant="outline" onClick={logout}>
        Sign Out
      </Button>
    </div>
  );
}
