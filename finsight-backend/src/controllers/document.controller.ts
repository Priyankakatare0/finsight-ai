import type { Request, Response } from "express";
import { documentService } from "../services/document.service";
import { AppError } from "../errors/AppError";
import type { UploadDocumentInput } from "../validators/document.schema";
import { ingestionQueue } from "../queues/ingestion.queue";

export class DocumentController {
  async upload(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    if (!req.file) {
      throw new AppError("No file uploaded", 400, "NO_FILE");
    }

    const metadata = req.body as UploadDocumentInput;
    const document = await documentService.uploadDocument(userId, req.file, metadata);

    // Queue document ingestion job for background processing
    try {
      await ingestionQueue.add(
        "ingest",
        { documentId: document._id.toString(), userId },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        }
      );
    } catch (queueErr: any) {
      console.warn("⚠️ [DocumentController] Redis queue offline. Running ingestion directly in background fallback...", queueErr?.message);
      import("../rag/ingestion/pipeline").then(({ runPipeline }) => {
        runPipeline(document._id.toString()).catch((err) => {
          console.error(`❌ Background direct ingestion failed for ${document._id}:`, err?.message);
        });
      });
    }

    res.status(201).json({
      success: true,
      data: {
        document,
      },
    });
  }

  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const documents = await documentService.getUserDocuments(userId);

    res.status(200).json({
      success: true,
      data: {
        documents,
      },
    });
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Document ID is required", 400, "INVALID_ID");
    }

    const document = await documentService.getDocumentById(userId, id);

    res.status(200).json({
      success: true,
      data: {
        document,
      },
    });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Document ID is required", 400, "INVALID_ID");
    }

    await documentService.deleteDocument(userId, id);

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  }

  async getFile(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }

    const id = req.params.id as string;
    if (!id) {
      throw new AppError("Document ID is required", 400, "INVALID_ID");
    }

    const { document, stream } = await documentService.getDocumentFileStream(
      userId,
      id
    );

    const safeFilename = `${encodeURIComponent(document.title.replace(/[^\w\s-]/gi, "_"))}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
    res.setHeader("Content-Length", document.fileSize);

    stream.on("error", (err) => {
      console.error("Stream error while sending PDF:", err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: "STREAM_ERROR",
            message: "Failed to stream document file",
          },
        });
      }
    });

    stream.pipe(res);
  }
}

export const documentController = new DocumentController();
export default documentController;

