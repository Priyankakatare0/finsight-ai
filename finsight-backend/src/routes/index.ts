import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import documentRoutes from "./document.routes";
import chatRoutes from "./chat.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/documents", documentRoutes);
router.use("/chat", chatRoutes);

export default router;
