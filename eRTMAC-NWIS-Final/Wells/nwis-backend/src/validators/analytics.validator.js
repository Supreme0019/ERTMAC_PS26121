// =============================================================================
// NWIS Backend — Analytics Validators (Zod)
// =============================================================================

const { z } = require('zod');

const analyticsQuerySchema = z.object({
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

const dashboardQuerySchema = z.object({
  field: z.string().max(150).optional(),
  status: z.enum(['active', 'completed', 'suspended', 'abandoned', 'planned']).optional(),
});

module.exports = { analyticsQuerySchema, dashboardQuerySchema };
