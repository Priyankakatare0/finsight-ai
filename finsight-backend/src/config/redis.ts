import { Redis } from "ioredis";
import { env } from "./env";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    // Avoid aggressive reconnect log spam; back off up to 15 seconds
    if (times > 3) {
      return 15000;
    }
    return Math.min(times * 1500, 5000);
  },
});

let lastWarningTime = 0;
const WARNING_THROTTLE_MS = 30000; // Log warning at most once every 30 seconds

redisConnection.on("error", (err: any) => {
  const now = Date.now();
  if (now - lastWarningTime > WARNING_THROTTLE_MS) {
    lastWarningTime = now;
    console.warn("\n⚠️  [Redis] Could not connect to Redis at " + env.REDIS_URL);
    console.warn("👉  Reason: " + (err?.message || "Connection refused (ECONNREFUSED)"));
    console.warn("💡  Fix: Start Docker Desktop and run: 'docker compose up -d' (or start local redis-server).\n");
  }
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected successfully");
  lastWarningTime = 0;
});

export default redisConnection;
