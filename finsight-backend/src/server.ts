import mongoose from "mongoose";
import app from "./app";
import { env } from "./config/env";

const startServer = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Automatically initialize background ingestion worker for seamless document processing
    try {
      await import("./workers/ingestion.worker");
      console.log("Background ingestion worker initialized");
    } catch (workerErr: any) {
      console.warn("Notice: Standalone BullMQ worker not initialized in server process:", workerErr?.message || workerErr);
    }

    app.listen(env.PORT, () => {
      console.log(`Server is running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

