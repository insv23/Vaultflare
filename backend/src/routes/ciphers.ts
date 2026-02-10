// input: authenticated cipher API requests and ciphers/users tables.
// output: cipher CRUD + sync endpoints with version conflict control.
// pos: encrypted vault data management layer on the server side.

import {
  createRoute,
  type OpenAPIHono,
  type RouteHandler,
  z,
} from "@hono/zod-openapi";

import { mapCipher, mapCipherList } from "../mappers/cipher.mapper";
import type { AppEnv } from "../types";
import { nowMs } from "../utils/crypto";

type CipherRow = {
  id: string;
  encrypted_dek: string;
  encrypted_data: string;
  item_version: number;
  vault_version: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};

const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  })
  .openapi("CipherErrorResponse");

const CipherSchema = z
  .object({
    cipher_id: z.uuid(),
    encrypted_dek: z.string(),
    encrypted_data: z.string(),
    item_version: z.number().int().positive(),
    vault_version: z.number().int().nonnegative(),
    deleted_at: z.number().int().positive().nullable(),
    created_at: z.number().int().positive(),
    updated_at: z.number().int().positive(),
  })
  .openapi("Cipher");

const CipherIdParamsSchema = z.object({
  id: z.uuid().openapi({
    param: {
      name: "id",
      in: "path",
    },
  }),
});

const CreateCipherRequestSchema = z
  .object({
    encrypted_dek: z.string().min(1),
    encrypted_data: z.string().min(1),
  })
  .openapi("CreateCipherRequest");

const CreateCipherResponseSchema = z
  .object({
    cipher_id: z.uuid(),
    item_version: z.number().int().positive(),
    created_at: z.number().int().positive(),
  })
  .openapi("CreateCipherResponse");

const CipherListResponseSchema = z
  .object({
    vault_version: z.number().int().nonnegative(),
    ciphers: z.array(CipherSchema),
  })
  .openapi("CipherListResponse");

const SyncQuerySchema = z.object({
  since_version: z.coerce.number().int().nonnegative().default(0),
});

const UpdateCipherRequestSchema = z
  .object({
    encrypted_dek: z.string().min(1),
    encrypted_data: z.string().min(1),
    expected_version: z.number().int().positive(),
  })
  .openapi("UpdateCipherRequest");

const UpdateCipherResponseSchema = z
  .object({
    cipher_id: z.uuid(),
    item_version: z.number().int().positive(),
    vault_version: z.number().int().nonnegative(),
    updated_at: z.number().int().positive(),
  })
  .openapi("UpdateCipherResponse");

const DeleteCipherQuerySchema = z.object({
  expected_version: z.coerce.number().int().positive(),
});

const DeleteCipherResponseSchema = z
  .object({
    cipher_id: z.uuid(),
    deleted_at: z.number().int().positive(),
    item_version: z.number().int().positive(),
    vault_version: z.number().int().nonnegative(),
  })
  .openapi("DeleteCipherResponse");

const createCipherRoute = createRoute({
  method: "post",
  path: "/api/ciphers",
  tags: ["Ciphers"],
  summary: "Create cipher",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateCipherRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Cipher created",
      content: { "application/json": { schema: CreateCipherResponseSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const listCiphersRoute = createRoute({
  method: "get",
  path: "/api/ciphers",
  tags: ["Ciphers"],
  summary: "List all ciphers",
  responses: {
    200: {
      description: "Cipher list",
      content: { "application/json": { schema: CipherListResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const syncCiphersRoute = createRoute({
  method: "get",
  path: "/api/ciphers/sync",
  tags: ["Ciphers"],
  summary: "Incremental sync ciphers",
  request: {
    query: SyncQuerySchema,
  },
  responses: {
    200: {
      description: "Sync result",
      content: { "application/json": { schema: CipherListResponseSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const getCipherRoute = createRoute({
  method: "get",
  path: "/api/ciphers/{id}",
  tags: ["Ciphers"],
  summary: "Get one cipher",
  request: {
    params: CipherIdParamsSchema,
  },
  responses: {
    200: {
      description: "Cipher data",
      content: { "application/json": { schema: CipherSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Cipher not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const updateCipherRoute = createRoute({
  method: "put",
  path: "/api/ciphers/{id}",
  tags: ["Ciphers"],
  summary: "Update cipher",
  request: {
    params: CipherIdParamsSchema,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateCipherRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Cipher updated",
      content: { "application/json": { schema: UpdateCipherResponseSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Cipher not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Version conflict",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const deleteCipherRoute = createRoute({
  method: "delete",
  path: "/api/ciphers/{id}",
  tags: ["Ciphers"],
  summary: "Soft delete cipher",
  request: {
    params: CipherIdParamsSchema,
    query: DeleteCipherQuerySchema,
  },
  responses: {
    200: {
      description: "Cipher deleted",
      content: { "application/json": { schema: DeleteCipherResponseSchema } },
    },
    400: {
      description: "Validation failed",
      content: { "application/json": { schema: ErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    404: {
      description: "Cipher not found",
      content: { "application/json": { schema: ErrorSchema } },
    },
    409: {
      description: "Version conflict",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

const fetchVaultVersion = async (
  db: D1Database,
  userId: string,
): Promise<number | null> => {
  const row = await db
    .prepare("SELECT vault_version FROM users WHERE id = ?")
    .bind(userId)
    .first<{ vault_version: number }>();
  return row ? Number(row.vault_version) : null;
};

const fetchCipherForUser = async (
  db: D1Database,
  userId: string,
  cipherId: string,
) =>
  db
    .prepare(
      `SELECT id, encrypted_dek, encrypted_data, item_version, vault_version, deleted_at, created_at, updated_at
       FROM ciphers
       WHERE id = ? AND user_id = ?`,
    )
    .bind(cipherId, userId)
    .first<CipherRow>();

export const registerCipherRoutes = (app: OpenAPIHono<AppEnv>) => {
  const createCipherHandler: RouteHandler<
    typeof createCipherRoute,
    AppEnv
  > = async (c) => {
    const { encrypted_dek, encrypted_data } = c.req.valid("json");
    const userId = c.get("userId");
    const cipherId = crypto.randomUUID();
    const now = nowMs();

    await c.env.DB.prepare(
      `INSERT INTO ciphers (id, user_id, encrypted_dek, encrypted_data, item_version, vault_version, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 0, NULL, ?, ?)`,
    )
      .bind(cipherId, userId, encrypted_dek, encrypted_data, now, now)
      .run();

    const cipher = await fetchCipherForUser(c.env.DB, userId, cipherId);
    if (!cipher) {
      throw new Error("Failed to create cipher");
    }

    return c.json(
      {
        cipher_id: cipherId,
        item_version: Number(cipher.item_version),
        created_at: Number(cipher.created_at),
      },
      201,
    );
  };

  const listCiphersHandler: RouteHandler<
    typeof listCiphersRoute,
    AppEnv
  > = async (c) => {
    const userId = c.get("userId");

    const rows = (await c.env.DB.prepare(
      `SELECT id, encrypted_dek, encrypted_data, item_version, vault_version, deleted_at, created_at, updated_at
       FROM ciphers
       WHERE user_id = ?
       ORDER BY vault_version ASC`,
    )
      .bind(userId)
      .all()) as { results?: CipherRow[] };

    const vaultVersion = await fetchVaultVersion(c.env.DB, userId);
    if (vaultVersion === null) {
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Invalid authorization token",
          },
        },
        401,
      );
    }

    return c.json(
      {
        vault_version: vaultVersion,
        ciphers: mapCipherList(rows.results ?? []),
      },
      200,
    );
  };

  const syncCiphersHandler: RouteHandler<
    typeof syncCiphersRoute,
    AppEnv
  > = async (c) => {
    const userId = c.get("userId");
    const { since_version } = c.req.valid("query");

    const rows = (await c.env.DB.prepare(
      `SELECT id, encrypted_dek, encrypted_data, item_version, vault_version, deleted_at, created_at, updated_at
       FROM ciphers
       WHERE user_id = ? AND vault_version > ?
       ORDER BY vault_version ASC`,
    )
      .bind(userId, since_version)
      .all()) as { results?: CipherRow[] };

    const vaultVersion = await fetchVaultVersion(c.env.DB, userId);
    if (vaultVersion === null) {
      return c.json(
        {
          error: {
            code: "unauthorized",
            message: "Invalid authorization token",
          },
        },
        401,
      );
    }

    return c.json(
      {
        vault_version: vaultVersion,
        ciphers: mapCipherList(rows.results ?? []),
      },
      200,
    );
  };

  const getCipherHandler: RouteHandler<typeof getCipherRoute, AppEnv> = async (
    c,
  ) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");

    const cipher = await fetchCipherForUser(c.env.DB, userId, id);
    if (!cipher || cipher.deleted_at !== null) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Cipher not found",
          },
        },
        404,
      );
    }

    return c.json(mapCipher(cipher), 200);
  };

  const updateCipherHandler: RouteHandler<
    typeof updateCipherRoute,
    AppEnv
  > = async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const existingCipher = await fetchCipherForUser(c.env.DB, userId, id);
    if (!existingCipher || existingCipher.deleted_at !== null) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Cipher not found",
          },
        },
        404,
      );
    }

    const currentVersion = Number(existingCipher.item_version);
    if (currentVersion !== body.expected_version) {
      return c.json(
        {
          error: {
            code: "conflict",
            message: "Version conflict",
            details: {
              expected_version: body.expected_version,
              current_version: currentVersion,
            },
          },
        },
        409,
      );
    }

    await c.env.DB.prepare(
      `UPDATE ciphers
       SET encrypted_dek = ?, encrypted_data = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(body.encrypted_dek, body.encrypted_data, id, userId)
      .run();

    const updatedCipher = await fetchCipherForUser(c.env.DB, userId, id);
    if (!updatedCipher) {
      throw new Error("Failed to update cipher");
    }

    return c.json(
      {
        cipher_id: id,
        item_version: Number(updatedCipher.item_version),
        vault_version: Number(updatedCipher.vault_version),
        updated_at: Number(updatedCipher.updated_at),
      },
      200,
    );
  };

  const deleteCipherHandler: RouteHandler<
    typeof deleteCipherRoute,
    AppEnv
  > = async (c) => {
    const userId = c.get("userId");
    const { id } = c.req.valid("param");
    const { expected_version } = c.req.valid("query");

    const existingCipher = await fetchCipherForUser(c.env.DB, userId, id);
    if (!existingCipher) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: "Cipher not found",
          },
        },
        404,
      );
    }

    const currentVersion = Number(existingCipher.item_version);
    if (currentVersion !== expected_version) {
      return c.json(
        {
          error: {
            code: "conflict",
            message: "Version conflict",
            details: {
              expected_version,
              current_version: currentVersion,
            },
          },
        },
        409,
      );
    }

    if (existingCipher.deleted_at === null) {
      await c.env.DB.prepare(
        `UPDATE ciphers
         SET deleted_at = ?
         WHERE id = ? AND user_id = ?`,
      )
        .bind(nowMs(), id, userId)
        .run();
    }

    const deletedCipher = await fetchCipherForUser(c.env.DB, userId, id);
    if (!deletedCipher || deletedCipher.deleted_at === null) {
      throw new Error("Failed to delete cipher");
    }

    return c.json(
      {
        cipher_id: id,
        deleted_at: Number(deletedCipher.deleted_at),
        item_version: Number(deletedCipher.item_version),
        vault_version: Number(deletedCipher.vault_version),
      },
      200,
    );
  };

  app.openapi(createCipherRoute, createCipherHandler);
  app.openapi(listCiphersRoute, listCiphersHandler);
  app.openapi(syncCiphersRoute, syncCiphersHandler);
  app.openapi(getCipherRoute, getCipherHandler);
  app.openapi(updateCipherRoute, updateCipherHandler);
  app.openapi(deleteCipherRoute, deleteCipherHandler);
};
