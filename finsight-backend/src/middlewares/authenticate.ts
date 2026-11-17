import type { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import type { AuthenticatedUser } from "../types/express";

export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError("Authorization token required", 401, "UNAUTHORIZED"));
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    next(new AppError("Authorization token required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    if (!decoded.sub) {
      next(new AppError("Invalid token payload", 401, "UNAUTHORIZED"));
      return;
    }

    const authenticatedUser: AuthenticatedUser = {
      id: decoded.sub as string,
      role: (decoded.role as string) || "user",
    };

    req.user = authenticatedUser;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError("Token has expired", 401, "TOKEN_EXPIRED"));
      return;
    }
    next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
};

export default authenticate;

