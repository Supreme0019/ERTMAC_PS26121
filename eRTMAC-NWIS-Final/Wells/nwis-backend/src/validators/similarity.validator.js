// =============================================================================
// NWIS Backend — Similarity Validators (Zod)
// =============================================================================

const { z } = require('zod');

const similarityParamsSchema = z.object({
  wellId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
});

const similarityQuerySchema = z.object({
  radius: z.coerce.number().min(0.1).max(500).optional().default(20),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const similarityBodySchema = z.object({
  wellId: z.string().uuid('Well ID must be a valid UUID'),
  radius: z.number().min(0.1).max(500).optional().default(20),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

module.exports = { similarityParamsSchema, similarityQuerySchema, similarityBodySchema };
