// input: shadcn Slider + Checkbox + Label, PasswordOptions 类型
// output: PasswordGeneratorOptions — 密码生成选项面板（长度滑块 + 4 个字符类型勾选框）
// pos: 共享面板组件，被 Vault 独立弹窗和 CipherForm 内嵌生成器共同使用
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import type { PasswordOptions } from "@/lib/generate-password"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type Props = {
  options: PasswordOptions
  onChange: (options: PasswordOptions) => void
}

const CHAR_TYPES = [
  { key: "uppercase" as const, label: "A-Z" },
  { key: "lowercase" as const, label: "a-z" },
  { key: "numbers" as const, label: "0-9" },
  { key: "symbols" as const, label: "!@#$" },
]

export default function PasswordGeneratorOptions({ options, onChange }: Props) {
  return (
    <div className="grid gap-4">
      {/* Length slider */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Length</Label>
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {options.length}
          </span>
        </div>
        <Slider
          min={8}
          max={128}
          step={1}
          value={[options.length]}
          onValueChange={([v]) => onChange({ ...options, length: v })}
        />
      </div>

      {/* Character type checkboxes */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {CHAR_TYPES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <Checkbox
              id={`pwgen-${key}`}
              checked={options[key]}
              onCheckedChange={(checked) =>
                onChange({ ...options, [key]: !!checked })
              }
            />
            <Label htmlFor={`pwgen-${key}`} className="text-sm cursor-pointer">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  )
}
