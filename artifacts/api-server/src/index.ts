import app from "./app";
import { logger } from "./lib/logger";
import { startTimestampSweeper } from "./lib/timestampSweeper";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// AEGIS v4.0.4 — OpenTimestamps Sweeper. Polls pending OTS receipts every
// OTS_SWEEPER_INTERVAL_MIN (default 15) for Bitcoin anchor confirmation.
// Multi-instance safe via pg_advisory_lock. Disable with OTS_SWEEPER_ENABLED=false.
const stopSweeper = startTimestampSweeper();

const shutdown = (signal: string) => {
  logger.info({ signal }, "shutdown signal received");
  stopSweeper();
  server.close(() => {
    logger.info("http server closed, exiting");
    process.exit(0);
  });
  // Hard exit safety net if close hangs.
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
