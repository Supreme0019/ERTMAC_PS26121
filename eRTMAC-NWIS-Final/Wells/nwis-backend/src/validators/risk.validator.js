// =============================================================================
// NWIS Backend — Risk Validators (Zod)
// =============================================================================

const { z } = require('zod');

const riskEvaluateSchema = z.object({
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
  depth: z.number().min(0).optional(),
  force: z.boolean().optional().default(false),
});

const riskQuerySchema = z.object({
  risk_type: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  from_depth: z.coerce.number().optional(),
  to_depth: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = { riskEvaluateSchema, riskQuerySchema };
