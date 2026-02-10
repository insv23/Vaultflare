// input: D1 database binding and user identifiers.
// output: typed helpers to fetch users by email/id for auth and routes.
// pos: small user data-access layer reused across handlers.

export type UserRow = {
  id: string;
  email: string;
  auth_key: string;
  kdf_salt: string;
  kdf_params: string;
  vault_version: number;
};

export const findUserByEmail = async (db: D1Database, email: string): Promise<UserRow | null> => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await db
    .prepare(
      `SELECT id, email, auth_key, kdf_salt, kdf_params, vault_version
       FROM users
       WHERE email = ?`,
    )
    .bind(normalizedEmail)
    .first<UserRow>();

  return user ?? null;
};

export const findUserById = async (db: D1Database, userId: string): Promise<UserRow | null> => {
  const user = await db
    .prepare(
      `SELECT id, email, auth_key, kdf_salt, kdf_params, vault_version
       FROM users
       WHERE id = ?`,
    )
    .bind(userId)
    .first<UserRow>();

  return user ?? null;
};
