import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IChunk {
  userId: Types.ObjectId;
  documentId: Types.ObjectId;
  chunkIndex: number;
  content: string;
  text?: string | undefined; // Compatibility alias
  pageStart: number;
  pageEnd: number;
  company: string;
  docType: string;
  fiscalYear?: number | undefined;
  fiscalQuarter?: string | undefined;
  embedding: number[];
  metadata?: Record<string, unknown> | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChunkDocument extends IChunk, Document {}

const chunkSchema = new Schema<IChunkDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: [true, "Chunk content is required"],
    },
    text: {
      type: String,
    },
    pageStart: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    pageEnd: {
      type: Number,
      required: true,
      default: 1,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    docType: {
      type: String,
      required: true,
      default: "10-K",
      index: true,
    },
    fiscalYear: {
      type: Number,
      index: true,
    },
    fiscalQuarter: {
      type: String,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: [true, "Embedding vector is required"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring idempotency (no duplicate chunk indices per document)
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

// Filter indexes for fast vector retrieval with metadata filtering
chunkSchema.index({ userId: 1, company: 1, fiscalYear: -1 });
chunkSchema.index({ userId: 1, createdAt: -1 });

export const ChunkModel: Model<IChunkDocument> =
  mongoose.models.Chunk ||
  mongoose.model<IChunkDocument>("Chunk", chunkSchema);

export default ChunkModel;
