// input: thrown application/runtime errors plus Zod validation results.
// output: normalized error responses in { error: { code, message, details? } } format.
// pos: shared response policy layer to keep API errors consistent.

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorPayload } from "../types";
type ValidationResult = {
  success: boolean;
  error?: {
    issues?: Array<{
      path?: PropertyKey[];
      message: string;
    }>;
  };
};

export class AppError extends Error {
  status: ContentfulStatusCode;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errorPayload = (
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ErrorPayload => ({
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
});

export const errorJson = <S extends ContentfulStatusCode>(
  c: Context,
  status: S,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) => c.json<ErrorPayload>(errorPayload(code, message, details), status);

export const validationHook = (result: ValidationResult, c: Context) => {
  if (result.success) {
    return;
  }

  const details: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) {
    const path =
      issue.path && issue.path.length > 0
        ? issue.path.map((segment) => String(segment)).join(".")
        : "request";
    details[path] = issue.message;
  }

  return c.json<ErrorPayload>(
    errorPayload("validation_error", "Request validation failed", details),
    400,
  );
};

export const toErrorResponse = (
  error: unknown,
): { status: ContentfulStatusCode; payload: ErrorPayload } => {
  if (error instanceof AppError) {
    return {
      status: error.status,
      payload: errorPayload(error.code, error.message, error.details),
    };
  }

  if (error instanceof HTTPException) {
    return {
      status: error.status as ContentfulStatusCode,
      payload: errorPayload(
        "internal_error",
        error.message || "Internal server error",
      ),
    };
  }

  return {
    status: 500,
    payload: errorPayload("internal_error", "Internal server error"),
  };
};

export const handleError = (c: Context, error: unknown) => {
  const { status, payload } = toErrorResponse(error);
  return c.json(payload, status);
};
