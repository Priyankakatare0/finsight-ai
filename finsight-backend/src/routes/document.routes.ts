import { Router } from "express";
import { documentController } from "../controllers/document.controller";
import { authenticate } from "../middlewares/authenticate";
import { uploadPdfMiddleware } from "../middlewares/upload";
import { validate } from "../middlewares/validate";
import { uploadDocumentSchema } from "../validators/document.schema";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All document routes require authentication
router.use(authenticate);

router.post(
  "/",
  uploadPdfMiddleware,
  validate(uploadDocumentSchema),
  asyncHandler((req, res) => documentController.upload(req, res))
);

router.get(
  "/",
  asyncHandler((req, res) => documentController.list(req, res))
);

router.get(
  "/:id",
  asyncHandler((req, res) => documentController.getOne(req, res))
);

router.delete(
  "/:id",
  asyncHandler((req, res) => documentController.delete(req, res))
);

router.get(
  "/:id/file",
  asyncHandler((req, res) => documentController.getFile(req, res))
);

export default router;

