// =============================================================================
// NWIS Backend — Express Application Setup
// =============================================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./utils/response');

const app = express();

// ── Security Middleware ─────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: false,
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // In dev, allow localhost on any port (e.g. 5173, 3000, 4000)
      if (env.isDev || origin.startsWith('http://localhost:')) {
        return callback(null, true);
      }
      if (origin === env.FRONTEND_URL) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for hackathon demo
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate Limiting ───────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── API Documentation (Swagger) ─────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'eRTMAC-NWIS API Docs',
}));

// ── Root Endpoint ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name: 'eRTMAC-NWIS Backend API',
    description: 'Nearby Wells Intelligence System for Smart India Hackathon PS 26121',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
    status: 'online',
  });
});

// ── Mount API Routes ────────────────────────────────────────────────────────
app.use('/api', routes);

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  return notFound(res, `Route ${req.method} ${req.originalUrl}`);
});

// ── Global Error Handler (must be registered last) ──────────────────────────
app.use(errorHandler);

module.exports = app;
