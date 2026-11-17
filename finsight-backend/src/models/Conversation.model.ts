import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IConversation {
  userId: Types.ObjectId;
  title: string;
  documentId?: Types.ObjectId | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document {}

const conversationSchema = new Schema<IConversationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      default: "New Conversation",
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
    },
  },
  {
    timestamps: true,
  }
);

// Index for listing user conversations ordered by last update
conversationSchema.index({ userId: 1, updatedAt: -1 });

export const ConversationModel: Model<IConversationDocument> =
  mongoose.models.Conversation ||
  mongoose.model<IConversationDocument>("Conversation", conversationSchema);

export default ConversationModel;
