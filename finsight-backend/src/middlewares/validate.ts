import type { Request, Response, NextFunction, RequestHandler } from "express";
import { type ZodSchema, ZodError } from "zod";
import { AppError } from "../errors/AppError";

export const validate = (schema: ZodSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join(", ");
        next(new AppError(message || "Validation failed", 400, "VALIDATION_ERROR"));
        return;
      }
      next(new AppError("Invalid request data", 400, "BAD_REQUEST"));
    }
  };
};

export default validate;

