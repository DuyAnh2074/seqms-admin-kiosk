const express = require('express');
const {
    getAll,
    getById,
    create,
    update,
    deleteOne,
    reactivate,
} = require('../controllers/service.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Service Routes
 * Base path: /api/services
 */

// GET all services
router.get('/', authenticate, getAll);

// GET service by ID
router.get('/:id', authenticate, getById);

// POST create new service
router.post('/', authenticate, create);

// PUT update service
router.put('/:id', authenticate, update);

// DELETE service (soft delete - deactivate)
router.delete('/:id', authenticate, deleteOne);

// POST reactivate service
router.post('/:id/reactivate', authenticate, reactivate);

module.exports = router;
