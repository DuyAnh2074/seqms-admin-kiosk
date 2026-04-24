const express = require('express');
const {
    getAll,
    getById,
    create,
    update,
    deleteOne,
} = require('../controllers/district.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * District Routes
 * Base path: /api/districts
 */

// GET all districts
router.get('/', authenticate, getAll);

// GET district by ID
router.get('/:id', authenticate, getById);

// POST create new district
router.post('/', authenticate, create);

// PUT update district
router.put('/:id', authenticate, update);

// DELETE district
router.delete('/:id', authenticate, deleteOne);

module.exports = router;
