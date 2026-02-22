# components/ — 可复用 UI 组件

一旦我所属的文件夹有所变化，请更新我。

shadcn/ui 生成的基础组件，被 pages/ 使用。

| 目录/文件 | 地位 | 功能 |
|------|------|------|
| ui/button.tsx | 基础组件 | Button，支持多种 variant 和 size |
| ui/input.tsx | 基础组件 | Input 文本输入框 |
| ui/label.tsx | 基础组件 | Label 表单标签 |
| ui/card.tsx | 基础组件 | Card 容器组件（Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter） |
| ui/dialog.tsx | 基础组件 | Dialog 弹窗组件（Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter） |
| ui/textarea.tsx | 基础组件 | Textarea 多行输入框 |
| CipherCard.tsx | 业务组件 | 单条密码条目卡片，彩色首字母头像 + 字段行布局（user/pass/url/notes），每行独立操作按钮（copy/eye/外链），密码可切换明文 |
| CipherForm.tsx | 业务组件 | 新增/编辑密码条目的 Dialog 表单，仅 name 必填，其余可选（至少填一个），统一 create 和 edit 两种模式 |
