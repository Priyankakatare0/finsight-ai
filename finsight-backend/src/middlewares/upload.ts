import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import multer, { type FileFilterCallback } from "multer";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../errors/AppError";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const TEMP_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "temp");

if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const isPdfMime = file.mimetype === "application/pdf";
  const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");

  if (!isPdfMime && !isPdfExt) {
    cb(new AppError("Only PDF documents are accepted", 400, "INVALID_FILE_TYPE"));
    return;
  }
  cb(null, true);
};

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter,
});

export const uploadPdfMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const uploadSingle = multerInstance.single("file");

  uploadSingle(req, res, async (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          next(new AppError("File size exceeds 25 MB limit", 400, "FILE_TOO_LARGE"));
          return;
        }
        next(new AppError(`Upload error: ${err.message}`, 400, "UPLOAD_ERROR"));
        return;
      }
      next(err);
      return;
    }

    if (!req.file) {
      next(new AppError("No PDF file provided in request (field 'file')", 400, "NO_FILE"));
      return;
    }

    // Magic bytes verification: First 5 bytes must be '%PDF-'
    try {
      const fd = await fs.promises.open(req.file.path, "r");
      const buffer = Buffer.alloc(5);
      const { bytesRead } = await fd.read(buffer, 0, 5, 0);
      await fd.close();

      const header = buffer.toString("utf8", 0, bytesRead);
      if (!header.startsWith("%PDF-")) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        next(
          new AppError(
            "Invalid file format: File header does not match %PDF- signature",
            400,
            "INVALID_PDF_SIGNATURE"
          )
        );
        return;
      }

      next();
    } catch (readError) {
      if (req.file.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
      next(new AppError("Failed to verify PDF file signature", 500, "FILE_READ_ERROR"));
    }
  });
};

export default uploadPdfMiddleware;

