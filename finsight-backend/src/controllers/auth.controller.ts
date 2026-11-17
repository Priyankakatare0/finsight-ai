import type { Request, Response, CookieOptions } from "express";
import { authService } from "../services/auth.service";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import type { RegisterInput, LoginInput } from "../validators/auth.schema";

export const REFRESH_COOKIE_NAME = "refreshToken";

export const getRefreshCookieOptions = (expiresAt: Date): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  expires: expiresAt,
  path: "/",
});

export const getClearCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;
    const { user, accessToken, refreshToken, expiresAt } =
      await authService.register(input);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(expiresAt));

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const input = req.body as LoginInput;
    const { user, accessToken, refreshToken, expiresAt } =
      await authService.login(input);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(expiresAt));

    res.status(200).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const headerToken = req.headers["x-refresh-token"] as string | undefined;
    const rawToken = cookieToken || headerToken || req.body?.refreshToken;

    if (!rawToken) {
      throw new AppError("Refresh token required", 401, "UNAUTHORIZED");
    }

    const { user, accessToken, refreshToken, expiresAt } =
      await authService.rotateRefreshToken(rawToken);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(expiresAt));

    res.status(200).json({
      success: true,
      data: {
        user,
        accessToken,
      },
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const headerToken = req.headers["x-refresh-token"] as string | undefined;
    const rawToken = cookieToken || headerToken || req.body?.refreshToken;

    if (rawToken) {
      await authService.logout(rawToken);
    }

    res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
}

export const authController = new AuthController();
export default authController;

