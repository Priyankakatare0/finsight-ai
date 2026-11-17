import mongoose from "mongoose";
import { env } from "./config/env";
import { ingestionWorker } from "./workers/ingestion.worker";
import { redisConnection } from "./config/redis";

async function startWorker() {
  try {
    console.log("👷 Starting FinSight AI Background Worker...");

    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log("Connected to MongoDB for background processing");

    console.log("Ingestion worker is running and listening for jobs on queue 'ingestion'");

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down worker gracefully...`);
      try {
        await ingestionWorker.close();
        console.log("BullMQ worker closed");

        await redisConnection.quit();
        console.log("Redis connection closed");

        await mongoose.disconnect();
        console.log("MongoDB connection closed");

        process.exit(0);
      } catch (err) {
        console.error("Error during graceful shutdown:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to start worker:", error);
    process.exit(1);
  }
}

startWorker();
