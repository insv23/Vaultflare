// input: Cloudflare request context, D1 binding, and route modules.
// output: unified Hono app exposing health, OpenAPI docs, auth, and cipher APIs.
// pos: backend composition root and global middleware/error policy.

import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { authMiddleware } from "./middleware/auth";
import { registerAuthRoutes } from "./routes/auth";
import { registerCipherRoutes } from "./routes/ciphers";
import type { AppEnv } from "./types";
import { handleError, validationHook } from "./utils/response";

const app = new OpenAPIHono<AppEnv>({
  defaultHook: validationHook,
});

app.onError((error, c) => handleError(c, error));

app.get("/health", (c) => c.json({ status: "ok" }));

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Vaultflare API",
    version: "1.1.0",
  },
});

app.get("/docs", Scalar({ url: "/openapi.json" }));

app.use("/api/auth/logout", authMiddleware);
app.use("/api/auth/password", authMiddleware);
app.use("/api/ciphers/*", authMiddleware);
app.use("/api/ciphers", authMiddleware);

registerAuthRoutes(app);
registerCipherRoutes(app);

export default app;
