const express = require('express');
const router = express.Router();
const serviceGroupController = require('../controllers/servicegroup.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Service Group Routes
 * Base path: /api/service-groups
 */

// GET all service groups
router.get('/', authenticate, serviceGroupController.getAll);

// GET service group by ID
router.get('/:id', authenticate, serviceGroupController.getById);

// POST create new service group
router.post('/', authenticate, serviceGroupController.create);

// PUT update service group
router.put('/:id', authenticate, serviceGroupController.update);

// DELETE service group (soft delete - deactivate)
router.delete('/:id', authenticate, serviceGroupController.deleteGroup);

// POST reactivate service group
router.post('/:id/reactivate', authenticate, serviceGroupController.reactivate);

module.exports = router;
