import type { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { AppError } from "../errors/AppError";

export class UserController {
  async getMe(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const user = await authService.getCurrentUser(userId);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  }
}

export const userController = new UserController();
export default userController;

