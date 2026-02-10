// input: Cloudflare bindings and middleware-injected request variables.
// output: shared AppEnv type used by routes/middleware for static typing.
// pos: central type contract for backend runtime boundaries.

export type AppEnv = {
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    userId: string;
    sessionToken: string;
  };
};

export type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
