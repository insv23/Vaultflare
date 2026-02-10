// input: auth_key strings and session lifetime settings.
// output: random session tokens, secure string compare, and time helpers.
// pos: crypto-adjacent helpers for auth/session flow.

const SESSION_TOKEN_BYTES = 32;
const SESSION_TTL_DAYS = 30;

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const generateSessionToken = (): string => {
  const bytes = new Uint8Array(SESSION_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

export const secureCompare = (left: string, right: string): boolean => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < leftBytes.length; i += 1) {
    diff |= leftBytes[i] ^ rightBytes[i];
  }

  return diff === 0;
};

export const nowMs = (): number => Date.now();

export const sessionExpiresAtMs = (): number => nowMs() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
