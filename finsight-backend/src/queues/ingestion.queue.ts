import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export interface IngestionJobData {
  documentId: string;
  userId: string;
}

export const ingestionQueue = new Queue<IngestionJobData>("ingestion", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600, // keep completed jobs for 1 hour
      count: 100, // keep max 100 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // keep failed jobs for 24 hours
    },
  },
});

export default ingestionQueue;
