import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";
import { User, type IUserDocument } from "../models/User.model";
import { RefreshToken } from "../models/RefreshToken.model";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import type { RegisterInput, LoginInput } from "../validators/auth.schema";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateAccessToken = (userId: string, role: string): string => {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = async (
  userId: string | Types.ObjectId
): Promise<{ rawToken: string; expiresAt: Date }> => {
  const rawToken = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
  });

  return { rawToken, expiresAt };
};

export class AuthService {
  async register(input: RegisterInput): Promise<{
    user: IUserDocument;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new AppError("Email already in use", 400, "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await User.create({
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role || "user",
    });

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const { rawToken: refreshToken, expiresAt } = await generateRefreshToken(user._id);

    return { user, accessToken, refreshToken, expiresAt };
  }

  async login(input: LoginInput): Promise<{
    user: IUserDocument;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const user = await User.findOne({ email: input.email.toLowerCase() });
    if (!user) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const { rawToken: refreshToken, expiresAt } = await generateRefreshToken(user._id);

    return { user, accessToken, refreshToken, expiresAt };
  }

  async rotateRefreshToken(rawToken: string): Promise<{
    user: IUserDocument;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    if (!rawToken) {
      throw new AppError("Refresh token is required", 401, "UNAUTHORIZED");
    }

    const tokenHash = hashToken(rawToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash });

    if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
      if (tokenRecord) {
        await RefreshToken.deleteOne({ _id: tokenRecord._id });
      }
      throw new AppError("Invalid or expired refresh token", 401, "UNAUTHORIZED");
    }

    // Delete used refresh token immediately for rotation
    await RefreshToken.deleteOne({ _id: tokenRecord._id });

    const user = await User.findById(tokenRecord.userId);
    if (!user) {
      throw new AppError("User not found", 401, "UNAUTHORIZED");
    }

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const { rawToken: newRefreshToken, expiresAt } = await generateRefreshToken(user._id);

    return { user, accessToken, refreshToken: newRefreshToken, expiresAt };
  }

  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await RefreshToken.deleteOne({ tokenHash });
    }
  }

  async getCurrentUser(userId: string): Promise<IUserDocument> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }
    return user;
  }
}

export const authService = new AuthService();
export default authService;

