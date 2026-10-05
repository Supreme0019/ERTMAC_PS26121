// =============================================================================
// NWIS Backend — Realtime Validators (Zod)
// =============================================================================

const { z } = require('zod');

const pushDataSchema = z.object({
  depth: z.number().min(0, 'Depth must be non-negative'),
  wob: z.number().optional(),
  rpm: z.number().optional(),
  torque: z.number().optional(),
  rop: z.number().optional(),
  mud_weight: z.number().optional(),
  mudWeight: z.number().optional(),
  mud_flow_rate: z.number().optional(),
  mudFlowRate: z.number().optional(),
  standpipe_pressure: z.number().optional(),
  standpipePressure: z.number().optional(),
  mudPressure: z.number().optional(),
  annular_pressure: z.number().optional(),
  annularPressure: z.number().optional(),
  hook_load: z.number().optional(),
  hookLoad: z.number().optional(),
  timestamp: z.string().datetime().optional(),
});

const replayStartSchema = z.object({
  wellId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  speedMs: z.number().int().min(500).max(30000).optional().default(3000),
});

const wellIdParamSchema = z.object({
  wellId: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
});

module.exports = { pushDataSchema, replayStartSchema, wellIdParamSchema };
