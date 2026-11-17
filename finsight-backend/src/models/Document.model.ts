import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type DocumentStatus =
  | "queued"
  | "parsing"
  | "chunking"
  | "embedding"
  | "indexed"
  | "failed";

export type DocType =
  | "10-K"
  | "10-Q"
  | "8-K"
  | "earnings_call"
  | "presentation"
  | "report"
  | "other";

export interface IDocument {
  userId: Types.ObjectId;
  title: string;
  storageKey: string;
  fileHash: string;
  fileSize: number;
  status: DocumentStatus;
  progress: number;
  errorMessage?: string | undefined;
  company: string;
  docType: DocType;
  fiscalYear?: number | undefined;
  fiscalQuarter?: string | undefined;
  pageCount: number;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentDocument extends IDocument, Document {}

const documentSchema = new Schema<IDocumentDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    storageKey: {
      type: String,
      required: [true, "Storage key is required"],
    },
    fileHash: {
      type: String,
      required: [true, "File hash is required"],
      index: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
    },
    status: {
      type: String,
      enum: ["queued", "parsing", "chunking", "embedding", "indexed", "failed"],
      default: "queued",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      index: true,
    },
    docType: {
      type: String,
      enum: ["10-K", "10-Q", "8-K", "earnings_call", "presentation", "report", "other"],
      default: "10-K",
    },
    fiscalYear: {
      type: Number,
    },
    fiscalQuarter: {
      type: String,
      enum: ["Q1", "Q2", "Q3", "Q4", "FY", "none", ""],
    },
    pageCount: {
      type: Number,
      default: 0,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ userId: 1, fileHash: 1 });
documentSchema.index({ userId: 1, createdAt: -1 });

export const DocumentModel: Model<IDocumentDocument> =
  mongoose.models.Document ||
  mongoose.model<IDocumentDocument>("Document", documentSchema);

export default DocumentModel;
