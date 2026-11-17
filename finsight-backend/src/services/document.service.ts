import fs from "node:fs";
import crypto from "node:crypto";
import { type Readable } from "node:stream";
import { DocumentModel, type IDocumentDocument, type DocType } from "../models/Document.model";
import { defaultStorageProvider } from "../providers/storage";
import { AppError } from "../errors/AppError";

export interface CreateDocumentInput {
  title?: string | undefined;
  company: string;
  docType?: DocType | undefined;
  fiscalYear?: number | string | undefined;
  fiscalQuarter?: string | undefined;
}

export class DocumentService {
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    metadata: CreateDocumentInput
  ): Promise<IDocumentDocument> {
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.promises.readFile(file.path);
    } catch {
      throw new AppError("Failed to read uploaded temporary file", 500, "FILE_READ_ERROR");
    }

    // Hash file content with SHA-256
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Golden Rule & Duplicate Check per user
    const existing = await DocumentModel.findOne({ userId, fileHash });
    if (existing) {
      await fs.promises.unlink(file.path).catch(() => {});
      throw new AppError(
        "A document with this exact content has already been uploaded to your workspace",
        409,
        "DUPLICATE_DOCUMENT"
      );
    }

    // Storage Key: uploads/<userId>/<uuid>.pdf
    const fileUuid = crypto.randomUUID();
    const storageKey = `${userId}/${fileUuid}.pdf`;

    try {
      await defaultStorageProvider.save(storageKey, fileBuffer);
    } catch {
      await fs.promises.unlink(file.path).catch(() => {});
      throw new AppError("Failed to persist document to storage", 500, "STORAGE_ERROR");
    } finally {
      // Always cleanup temp multer file
      await fs.promises.unlink(file.path).catch(() => {});
    }

    const title =
      metadata.title?.trim() ||
      file.originalname.replace(/\.pdf$/i, "").trim() ||
      "Untitled Document";

    const doc = await DocumentModel.create({
      userId,
      title,
      storageKey,
      fileHash,
      fileSize: file.size,
      status: "queued",
      progress: 0,
      company: metadata.company.trim() || "Unknown",
      docType: metadata.docType || "10-K",
      fiscalYear: metadata.fiscalYear ? Number(metadata.fiscalYear) : undefined,
      fiscalQuarter: metadata.fiscalQuarter?.trim() || undefined,
      pageCount: 0,
      chunkCount: 0,
    });

    return doc;
  }

  async getUserDocuments(userId: string): Promise<IDocumentDocument[]> {
    return await DocumentModel.find({ userId }).sort({ createdAt: -1 });
  }

  async getDocumentById(userId: string, documentId: string): Promise<IDocumentDocument> {
    const document = await DocumentModel.findOne({ _id: documentId, userId });
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }
    return document;
  }

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const document = await DocumentModel.findOne({ _id: documentId, userId });
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    await defaultStorageProvider.delete(document.storageKey);
    await DocumentModel.deleteOne({ _id: documentId, userId });
  }

  async getDocumentFileStream(
    userId: string,
    documentId: string
  ): Promise<{ document: IDocumentDocument; stream: Readable }> {
    const document = await DocumentModel.findOne({ _id: documentId, userId });
    if (!document) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    const exists = await defaultStorageProvider.exists(document.storageKey);
    if (!exists) {
      throw new AppError("Document physical file not found", 404, "FILE_NOT_FOUND");
    }

    const stream = defaultStorageProvider.createReadStream(document.storageKey);
    return { document, stream };
  }
}

export const documentService = new DocumentService();
export default documentService;
