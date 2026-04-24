const express = require('express');
const {
    getAll,
    getById,
    create,
    update,
    deleteOne,
} = require('../controllers/province.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Province Routes
 * Base path: /api/provinces
 */

// GET all provinces
router.get('/', authenticate, getAll);

// GET province by ID
router.get('/:id', authenticate, getById);

// POST create new province
router.post('/', authenticate, create);

// PUT update province
router.put('/:id', authenticate, update);

// DELETE province
router.delete('/:id', authenticate, deleteOne);

module.exports = router;
