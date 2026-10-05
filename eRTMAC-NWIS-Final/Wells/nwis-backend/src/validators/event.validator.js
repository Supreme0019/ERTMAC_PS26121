// =============================================================================
// NWIS Backend — Event Validators (Zod)
// =============================================================================

const { z } = require('zod');

const createEventSchema = z.object({
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
  formation_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional().nullable(),
  depth: z.number().min(0),
  event_type: z.enum([
    'mud_loss', 'kick', 'stuck_pipe', 'fishing',
    'npt', 'wellbore_instability', 'gas_cut',
    'tight_hole', 'lost_circulation', 'well_control',
    'equipment_failure', 'casing_issue', 'cementing_issue',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  description: z.string().optional(),
  start_time: z.string().datetime().optional().nullable(),
  end_time: z.string().datetime().optional().nullable(),
  source_document_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional().nullable(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateEventSchema = createEventSchema.partial().omit({ well_id: true });

const eventQuerySchema = z.object({
  from_depth: z.coerce.number().optional(),
  to_depth: z.coerce.number().optional(),
  event_type: z.string().optional(),
  severity: z.string().optional(),
  formation: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const mitigationSchema = z.object({
  event_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
  action: z.string().min(1),
  outcome: z.string().optional(),
  notes: z.string().optional(),
  source_document_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional().nullable(),
});

module.exports = { createEventSchema, updateEventSchema, eventQuerySchema, mitigationSchema };
