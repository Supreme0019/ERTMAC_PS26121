// =============================================================================
// NWIS Backend — Users Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireSystemAdmin } = require('../middleware/rbac');

router.get('/', authenticate, requireAdmin, usersController.list);
router.post('/', authenticate, requireSystemAdmin, usersController.create);
router.get('/:id', authenticate, usersController.getById);
router.patch('/:id', authenticate, requireAdmin, usersController.update);
router.delete('/:id', authenticate, requireAdmin, usersController.delete);

module.exports = router;
