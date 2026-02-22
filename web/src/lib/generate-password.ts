// input: 无外部依赖，使用 Web Crypto API
// output: PasswordOptions 类型 + generatePassword() 纯函数
// pos: 密码生成的核心逻辑，被 Vault 页面和 CipherForm 共享调用
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

export type PasswordOptions = {
  length: number // 8-128
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
}

const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*",
} as const

export function generatePassword(options: PasswordOptions): string {
  // 收集启用的字符集，无任何类型启用时 fallback 到 lowercase
  const enabledSets: string[] = []
  if (options.uppercase) enabledSets.push(CHARSETS.uppercase)
  if (options.lowercase) enabledSets.push(CHARSETS.lowercase)
  if (options.numbers) enabledSets.push(CHARSETS.numbers)
  if (options.symbols) enabledSets.push(CHARSETS.symbols)
  if (enabledSets.length === 0) enabledSets.push(CHARSETS.lowercase)

  const pool = enabledSets.join("")
  const length = Math.max(8, Math.min(128, options.length))

  // 每个启用的字符集至少抽一个，剩余从混合池随机填充
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)

  const chars: string[] = []
  for (let i = 0; i < enabledSets.length; i++) {
    const set = enabledSets[i]
    chars.push(set[bytes[i] % set.length])
  }
  for (let i = enabledSets.length; i < length; i++) {
    chars.push(pool[bytes[i] % pool.length])
  }

  // Fisher-Yates shuffle，避免前几位总是固定顺序
  const shuffleBytes = new Uint32Array(chars.length)
  crypto.getRandomValues(shuffleBytes)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join("")
}
