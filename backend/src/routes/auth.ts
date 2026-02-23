// input: auth-related HTTP requests and users/sessions tables.
// output: register/login/logout endpoints with validated payloads and typed responses.
// pos: authentication API surface for account/session lifecycle.

import {
  createRoute,
  type OpenAPIHono,
  type RouteHandler,
  z,
} from "@hono/zod-openapi";

import type { AppEnv } from "../types";
import {
  generateSessionToken,
  nowMs,
  secureCompare,
  sessionExpiresAtMs,
} from "../utils/crypto";
import { errorPayload } from "../utils/response";
import { findUserByEmail, findUserById } from "../utils/user-helper";

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .openapi("ErrorResponse");

const KdfParamsSchema = z
  .looseObject({
    iterations: z.number().int().positive().optional(),
    memory: z.number().int().positive().optional(),
    parallelism: z.number().int().positive().optional(),
  })
  .openapi("KdfParams");

const RegisterRequestSchema = z
  .object({
    email: z.email(),
    auth_key: z.string().min(16),
    kdf_salt: z.string().min(16),
    kdf_params: KdfParamsSchema,
  })
  .openapi("RegisterRequest");

const RegisterResponseSchema = z
  .object({
    user_id: z.uuid(),
    email: z.email(),
    vault_version: z.number().int().nonnegative(),
  })
  .openapi("RegisterResponse");

const LoginChallengeRequestSchema = z
  .object({
    email: z.email(),
  })
  .openapi("LoginChallengeRequest");

const LoginChallengeResponseSchema = z
  .object({
    user_id: z.uuid(),
    email: z.email(),
    kdf_salt: z.string(),
    kdf_params: KdfParamsSchema,
    vault_version: z.number().int().nonnegative(),
  })
  .openapi("LoginChallengeResponse");

const LoginVerifyRequestSchema = z
  .object({
    email: z.email(),
    auth_key: z.string().min(16),
  })
  .openapi("LoginVerifyRequest");

const LoginVerifyResponseSchema = z
  .object({
    access_token: z.string(),
    token_type: z.literal("Bearer"),
    expires_at: z.number().int().positive(),
    user_id: z.uuid(),
    vault_version: z.number().int().nonnegative(),
  })
  .openapi("LoginVerifyResponse");

const LogoutResponseSchema = z
  .object({
    logged_out: z.literal(true),
  })
  .openapi("LogoutResponse");

const DekUpdateSchema = z
  .object({
    cipher_id: z.uuid(),
    encrypted_dek: z.string().min(1),
  })
  .openapi("DekUpdate");

const ChangePasswordRequestSchema = z
  .object({
    old_auth_key: z.string().min(16),
    new_auth_key: z.string().min(16),
    new_kdf_salt: z.string().min(16),
    new_kdf_params: KdfParamsSchema,
    deks: z.array(DekUpdateSchema),
  })
  .openapi("ChangePasswordRequest");

const ChangePasswordResponseSchema = z
  .object({
    access_token: z.string(),
    token_type: z.literal("Bearer"),
    expires_at: z.number().int().positive(),
    user_id: z.uuid(),
    vault_version: z.number().int().nonnegative(),
  })
  .openapi("ChangePasswordResponse");

const registerRoute = createRoute({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Register user",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User registered",
      content: {
        "application/json": {
          schema: RegisterResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    403: {
      description: "Registration disabled",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Email already exists",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const loginChallengeRoute = createRoute({
  method: "post",
  path: "/api/auth/login/challenge",
  tags: ["Auth"],
  summary: "Get login challenge parameters",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: LoginChallengeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Challenge data",
      content: {
        "application/json": {
          schema: LoginChallengeResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const loginVerifyRoute = createRoute({
  method: "post",
  path: "/api/auth/login/verify",
  tags: ["Auth"],
  summary: "Verify login credentials",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: LoginVerifyRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login success",
      content: {
        "application/json": {
          schema: LoginVerifyResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Invalid credentials",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const logoutRoute = createRoute({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Logout current session",
  responses: {
    200: {
      description: "Logout success",
      content: {
        "application/json": {
          schema: LogoutResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const changePasswordRoute = createRoute({
  method: "put",
  path: "/api/auth/password",
  tags: ["Auth"],
  summary: "Change master password",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ChangePasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password changed",
      content: {
        "application/json": {
          schema: ChangePasswordResponseSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Invalid old password",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const parseKdfParams = (kdfParams: string): z.infer<typeof KdfParamsSchema> => {
  try {
    return KdfParamsSchema.parse(JSON.parse(kdfParams));
  } catch {
    return {};
  }
};

export const registerAuthRoutes = (app: OpenAPIHono<AppEnv>) => {
  const registerHandler: RouteHandler<typeof registerRoute, AppEnv> = async (
    c,
  ) => {
    if (c.env.ALLOW_REGISTRATION !== "true") {
      return c.json(
        errorPayload("registration_disabled", "Registration is currently disabled"),
        403,
      );
    }

    const body = c.req.valid("json");
    const email = body.email.trim().toLowerCase();

    const existingUser = await findUserByEmail(c.env.DB, email);
    if (existingUser) {
      return c.json(
        errorPayload(
          "email_already_exists",
          "This email is already registered",
        ),
        409,
      );
    }

    const userId = crypto.randomUUID();
    const now = nowMs();

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, auth_key, kdf_salt, kdf_params, vault_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    )
      .bind(
        userId,
        email,
        body.auth_key,
        body.kdf_salt,
        JSON.stringify(body.kdf_params),
        now,
        now,
      )
      .run();

    return c.json(
      {
        user_id: userId,
        email,
        vault_version: 0,
      },
      201,
    );
  };

  const loginChallengeHandler: RouteHandler<
    typeof loginChallengeRoute,
    AppEnv
  > = async (c) => {
    const { email } = c.req.valid("json");
    const user = await findUserByEmail(c.env.DB, email);

    if (!user) {
      return c.json(
        errorPayload("invalid_credentials", "Invalid email or password"),
        401,
      );
    }

    return c.json(
      {
        user_id: user.id,
        email: user.email,
        kdf_salt: user.kdf_salt,
        kdf_params: parseKdfParams(user.kdf_params),
        vault_version: Number(user.vault_version),
      },
      200,
    );
  };

  const loginVerifyHandler: RouteHandler<
    typeof loginVerifyRoute,
    AppEnv
  > = async (c) => {
    const body = c.req.valid("json");
    const email = body.email.trim().toLowerCase();

    const user = await findUserByEmail(c.env.DB, email);
    if (!user || !secureCompare(user.auth_key, body.auth_key)) {
      return c.json(
        errorPayload("invalid_credentials", "Invalid email or password"),
        401,
      );
    }

    const token = generateSessionToken();
    const expiresAt = sessionExpiresAtMs();
    const now = nowMs();

    await c.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at, revoked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    )
      .bind(crypto.randomUUID(), user.id, token, expiresAt, now, now)
      .run();

    return c.json(
      {
        access_token: token,
        token_type: "Bearer" as const,
        expires_at: expiresAt,
        user_id: user.id,
        vault_version: Number(user.vault_version),
      },
      200,
    );
  };

  const logoutHandler: RouteHandler<typeof logoutRoute, AppEnv> = async (c) => {
    const token = c.get("sessionToken");

    await c.env.DB.prepare(
      `UPDATE sessions
       SET revoked_at = ?
       WHERE token = ? AND revoked_at IS NULL`,
    )
      .bind(nowMs(), token)
      .run();

    return c.json({ logged_out: true as const }, 200);
  };

  const changePasswordHandler: RouteHandler<
    typeof changePasswordRoute,
    AppEnv
  > = async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");

    const user = await findUserById(c.env.DB, userId);
    if (!user || !secureCompare(user.auth_key, body.old_auth_key)) {
      return c.json(
        errorPayload("invalid_credentials", "Invalid old password"),
        401,
      );
    }

    const now = nowMs();
    const token = generateSessionToken();
    const expiresAt = sessionExpiresAtMs();
    const newSessionId = crypto.randomUUID();

    // Build batch statements
    const statements: D1PreparedStatement[] = [];

    // 1. Update user credentials
    statements.push(
      c.env.DB.prepare(
        `UPDATE users SET auth_key = ?, kdf_salt = ?, kdf_params = ?, updated_at = ?
         WHERE id = ?`,
      ).bind(
        body.new_auth_key,
        body.new_kdf_salt,
        JSON.stringify(body.new_kdf_params),
        now,
        userId,
      ),
    );

    // 2. Re-encrypt each DEK
    for (const dek of body.deks) {
      statements.push(
        c.env.DB.prepare(
          `UPDATE ciphers SET encrypted_dek = ?, updated_at = ?
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        ).bind(dek.encrypted_dek, now, dek.cipher_id, userId),
      );
    }

    // 3. Revoke all existing sessions
    statements.push(
      c.env.DB.prepare(
        `UPDATE sessions SET revoked_at = ?
         WHERE user_id = ? AND revoked_at IS NULL`,
      ).bind(now, userId),
    );

    // 4. Create new session
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO sessions (id, user_id, token, expires_at, revoked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      ).bind(newSessionId, userId, token, expiresAt, now, now),
    );

    await c.env.DB.batch(statements);

    // Read final vault_version
    const updated = await findUserById(c.env.DB, userId);
    const vaultVersion = updated ? Number(updated.vault_version) : 0;

    return c.json(
      {
        access_token: token,
        token_type: "Bearer" as const,
        expires_at: expiresAt,
        user_id: userId,
        vault_version: vaultVersion,
      },
      200,
    );
  };

  app.openapi(registerRoute, registerHandler);
  app.openapi(loginChallengeRoute, loginChallengeHandler);
  app.openapi(loginVerifyRoute, loginVerifyHandler);
  app.openapi(logoutRoute, logoutHandler);
  app.openapi(changePasswordRoute, changePasswordHandler);
};
