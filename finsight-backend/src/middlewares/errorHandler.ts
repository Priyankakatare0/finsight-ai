import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/AppError";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.issues.map((i) => i.message).join(", ") || "Validation failed",
      },
    });
    return;
  }

  const standardError = err as Error;
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: standardError?.message || "Internal Server Error",
    },
  });
};

export default errorHandler;
