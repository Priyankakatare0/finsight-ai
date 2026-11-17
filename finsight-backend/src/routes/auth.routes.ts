import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate";
import { registerSchema, loginSchema } from "../validators/auth.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler((req, res) => authController.register(req, res))
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler((req, res) => authController.login(req, res))
);

router.post(
  "/refresh",
  asyncHandler((req, res) => authController.refresh(req, res))
);

router.post(
  "/logout",
  asyncHandler((req, res) => authController.logout(req, res))
);

export default router;

