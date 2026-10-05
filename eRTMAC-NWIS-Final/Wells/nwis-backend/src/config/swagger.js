// =============================================================================
// NWIS Backend — Swagger / OpenAPI Specification
// =============================================================================

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'eRTMAC-NWIS Backend API',
      version: '1.0.0',
      description:
        'RESTful API for Problem Statement 26121 — Nearby Wells Intelligence System (eRTMAC-NWIS). ' +
        'Provides spatial GIS querying with PostGIS, historical offset well analysis, drilling parameter monitoring, ' +
        'risk prediction, real-time alert dispatching, RAG assistance, and document intelligence.',
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token obtained from /api/auth/login',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
