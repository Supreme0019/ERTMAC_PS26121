// =============================================================================
// NWIS Backend — Auth Validators (Zod)
// =============================================================================

const { z } = require('zod');
const { ROLES } = require('../middleware/rbac');

const registerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  // Client-supplied role is ignored/neutralized and mapped strictly to DRILLING_ENGINEER
  role: z.string().optional().transform(() => ROLES.DRILLING_ENGINEER).default(ROLES.DRILLING_ENGINEER),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

module.exports = { registerSchema, loginSchema, refreshSchema };
