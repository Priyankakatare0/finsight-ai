import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { authenticate } from "../middlewares/authenticate";
import { validate } from "../middlewares/validate";
import {
  createConversationSchema,
  updateConversationSchema,
  sendMessageSchema,
} from "../validators/chat.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// Conversations CRUD
router.post(
  "/conversations",
  validate(createConversationSchema),
  asyncHandler((req, res) => chatController.createConversation(req, res))
);

router.patch(
  "/conversations/:id",
  validate(updateConversationSchema),
  asyncHandler((req, res) => chatController.updateConversation(req, res))
);

router.get(
  "/conversations",
  asyncHandler((req, res) => chatController.listConversations(req, res))
);

router.get(
  "/conversations/:id",
  asyncHandler((req, res) => chatController.getConversation(req, res))
);

router.delete(
  "/conversations/:id",
  asyncHandler((req, res) => chatController.deleteConversation(req, res))
);

router.get(
  "/conversations/:id/messages",
  asyncHandler((req, res) => chatController.getMessages(req, res))
);

// Stream chat response via SSE
router.post(
  "/conversations/:id/messages",
  validate(sendMessageSchema),
  asyncHandler((req, res) => chatController.sendMessage(req, res))
);

export default router;
