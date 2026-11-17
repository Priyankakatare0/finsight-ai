import { Worker, type Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { runPipeline } from "../rag/ingestion/pipeline";
import type { IngestionJobData } from "../queues/ingestion.queue";

export const ingestionWorker = new Worker<IngestionJobData>(
  "ingestion",
  async (job: Job<IngestionJobData>) => {
    const { documentId, userId } = job.data;
    console.log(
      `[Worker] Processing document ${documentId} for user ${userId} (Attempt ${job.attemptsMade + 1} of ${job.opts.attempts})`
    );

    await runPipeline(documentId);

    console.log(`[Worker] Successfully completed document ${documentId}`);
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

ingestionWorker.on("completed", (job: Job<IngestionJobData>) => {
  console.log(`[Worker] Job ${job.id} completed for document ${job.data.documentId}`);
});

ingestionWorker.on("failed", (job: Job<IngestionJobData> | undefined, err: Error) => {
  console.error(
    `[Worker] Job ${job?.id} failed for document ${job?.data.documentId}. Error: ${err.message}`
  );
});

ingestionWorker.on("error", (err: Error) => {
  console.error("[Worker] Internal worker error:", err.message);
});

export default ingestionWorker;
