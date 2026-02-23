// input: usePasswordStrength hook
// output: PasswordStrengthBar — 密码强度可视化指示器（彩色进度条 + 等级文字 + 改进建议）
// pos: 被 Register.tsx、CipherForm.tsx、ChangePasswordForm.tsx 共用
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { usePasswordStrength } from "@/lib/use-password-strength";

const STRENGTH_CONFIG = [
  { label: "Very weak", color: "bg-red-500" },
  { label: "Weak", color: "bg-orange-500" },
  { label: "Fair", color: "bg-yellow-500" },
  { label: "Strong", color: "bg-green-500" },
  { label: "Very strong", color: "bg-emerald-500" },
] as const;

export default function PasswordStrengthBar({ password }: { password: string }) {
  const result = usePasswordStrength(password);

  if (!result) return null;

  const { label, color } = STRENGTH_CONFIG[result.score];
  const widthPercent = ((result.score + 1) / 5) * 100;
  const tips = [result.warning, ...result.suggestions].filter(Boolean);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${widthPercent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      </div>
      {tips.length > 0 && (
        <p className="text-xs text-muted-foreground">{tips.join(" ")}</p>
      )}
    </div>
  );
}
