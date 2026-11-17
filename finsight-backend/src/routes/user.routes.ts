import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authenticate } from "../middlewares/authenticate";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/me",
  authenticate,
  asyncHandler((req, res) => userController.getMe(req, res))
);

export default router;

