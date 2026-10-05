// =============================================================================
// NWIS Backend — Assistant / RAG Validators (Zod)
// =============================================================================

const { z } = require('zod');

const askSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000),
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  well_name: z.string().max(150).optional(),
  session_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  context: z.object({
    depth: z.number().min(0).optional(),
    formation: z.string().max(150).optional(),
    include_nearby: z.boolean().optional().default(true),
    include_parameters: z.boolean().optional().default(true),
  }).optional(),
});

const sessionQuerySchema = z.object({
  session_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
});

module.exports = { askSchema, sessionQuerySchema };
