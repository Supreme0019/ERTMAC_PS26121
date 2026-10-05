// =============================================================================
// NWIS Backend — Document Validators (Zod)
// =============================================================================

const { z } = require('zod');

const documentUploadSchema = z.object({
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  document_type: z.enum([
    'daily_drilling_report', 'end_of_well_report', 'mud_log',
    'geological_report', 'well_completion_report', 'incident_report',
    'survey_report', 'casing_report', 'cementing_report',
    'bit_record', 'other',
  ]).optional().default('other'),
  document_date: z.string().optional().nullable(),
});

const documentQuerySchema = z.object({
  well_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID').optional(),
  document_type: z.string().optional(),
  processing_status: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

module.exports = { documentUploadSchema, documentQuerySchema };
