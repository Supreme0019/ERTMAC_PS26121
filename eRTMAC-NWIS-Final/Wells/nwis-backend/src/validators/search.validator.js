// =============================================================================
// NWIS Backend — Search Validators (Zod)
// =============================================================================

const { z } = require('zod');

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(500),
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  type: z.enum(['all', 'wells', 'events', 'documents', 'formations']).optional().default('all'),
  formation: z.string().max(150).optional(),
  event_type: z.string().max(50).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  from_depth: z.coerce.number().min(0).optional(),
  to_depth: z.coerce.number().min(0).optional(),
  use_ai: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const autocompleteSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});

const vectorSearchSchema = z.object({
  query: z.string().min(1, 'Vector search query is required').max(1000),
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

module.exports = { searchQuerySchema, autocompleteSchema, vectorSearchSchema };
