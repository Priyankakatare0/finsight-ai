import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "streaming" | "completed" | "failed";

export interface IMessageSource {
  chunkId?: Types.ObjectId | string | undefined;
  documentId?: Types.ObjectId | string | undefined;
  title: string;
  page: number;
  pageEnd?: number | undefined;
  snippet: string;
  score?: number | undefined;
}

export interface IMessage {
  conversationId: Types.ObjectId;
  role: MessageRole;
  content: string;
  sources: IMessageSource[];
  status: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const messageSourceSchema = new Schema<IMessageSource>(
  {
    chunkId: {
      type: Schema.Types.Mixed,
    },
    documentId: {
      type: Schema.Types.Mixed,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    page: {
      type: Number,
      required: true,
    },
    pageEnd: {
      type: Number,
    },
    snippet: {
      type: String,
      required: true,
      trim: true,
    },
    score: {
      type: Number,
    },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: [true, "conversationId is required"],
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: [true, "role is required"],
    },
    content: {
      type: String,
      required: true,
      default: "",
    },
    sources: {
      type: [messageSourceSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "streaming", "completed", "failed"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

// Index for chronological message retrieval per conversation
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const MessageModel: Model<IMessageDocument> =
  mongoose.models.Message ||
  mongoose.model<IMessageDocument>("Message", messageSchema);

export default MessageModel;
