// =============================================================================
// NWIS Backend — Logger (Pino)
// =============================================================================

const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: { service: 'nwis-backend' },
});

module.exports = logger;
