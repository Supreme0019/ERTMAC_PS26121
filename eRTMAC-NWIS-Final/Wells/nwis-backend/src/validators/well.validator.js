// =============================================================================
// NWIS Backend — Well Validators (Zod)
// =============================================================================

const { z } = require('zod');

const createWellSchema = z.object({
  well_name: z.string().min(1).max(150),
  field: z.string().max(150).optional(),
  status: z.enum(['active', 'completed', 'suspended', 'abandoned', 'planned']).optional().default('planned'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  spud_date: z.string().datetime().optional().nullable(),
  total_depth: z.number().positive().optional().nullable(),
  current_depth: z.number().min(0).optional().default(0),
});

const updateWellSchema = z.object({
  well_name: z.string().min(1).max(150).optional(),
  field: z.string().max(150).optional(),
  status: z.enum(['active', 'completed', 'suspended', 'abandoned', 'planned']).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  spud_date: z.string().datetime().optional().nullable(),
  total_depth: z.number().positive().optional().nullable(),
  current_depth: z.number().min(0).optional(),
});

const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(0.1).max(500).optional().default(10),
  formation: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const wellIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
});

const trajectorySchema = z.object({
  measured_depth: z.number().min(0),
  tvd: z.number().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  inclination: z.number().min(0).max(180).optional(),
  azimuth: z.number().min(0).max(360).optional(),
});

const trajectoryBatchSchema = z.object({
  points: z.array(trajectorySchema).min(1),
});

const formationAssignSchema = z.object({
  formation_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID'),
  top_depth: z.number().min(0),
  bottom_depth: z.number().min(0),
  metadata: z.record(z.any()).optional(),
});

module.exports = {
  createWellSchema,
  updateWellSchema,
  nearbyQuerySchema,
  wellIdParamSchema,
  trajectorySchema,
  trajectoryBatchSchema,
  formationAssignSchema,
};
