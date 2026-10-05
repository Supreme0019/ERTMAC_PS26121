// =============================================================================
// NWIS Backend — Server Entry Point
// =============================================================================

const app = require('./app');
const env = require('./config/env');
const db = require('./config/database');
const logger = require('./utils/logger');
const riskEvaluationJob = require('./jobs/riskEvaluation.job');
const analyticsJob = require('./jobs/analytics.job');
const initDB = require('./db/schema');

let server;

async function startServer() {
  logger.info({ env: env.NODE_ENV }, 'Initializing eRTMAC-NWIS backend server...');

  // 1. Verify Database Connection
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    logger.warn('Database connection check failed — queries may fail until PostgreSQL is running');
  }

  // 2. Auto-initialize schema & seed data (idempotent — safe on every restart)
  if (dbConnected) {
    await initDB();
  }

  // 3. Start Background Jobs (when DB is accessible)
  if (dbConnected) {
    riskEvaluationJob.start(60000); // Check active wells every 60s
    analyticsJob.start(300000);     // Aggregate analytics every 5m
  }

  // 3. Start Express HTTP Server
  server = app.listen(env.PORT, () => {
    logger.info(
      `🚀 eRTMAC-NWIS Backend running at http://localhost:${env.PORT} in [${env.NODE_ENV}] mode`
    );
    logger.info(`📖 API Documentation available at http://localhost:${env.PORT}/api/docs`);
    logger.info(`🔍 Health check available at http://localhost:${env.PORT}/api/health`);
  });

  // Handle server errors
  server.on('error', (err) => {
    logger.fatal({ err }, 'Server failed to start');
    process.exit(1);
  });
}

// ── Graceful Shutdown ───────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated...');

  riskEvaluationJob.stop();
  analyticsJob.stop();

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await db.close();
        logger.info('Database connections closed');
      } catch (err) {
        logger.error({ err }, 'Error closing database pool');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception thrown');
  shutdown('uncaughtException');
});

// Start the server
startServer();
