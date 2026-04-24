const express = require('express');
const {
    getAll,
    getById,
    create,
    update,
    deleteOne,
    reactivate,
} = require('../controllers/ticketformat.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Ticket Format Routes
 * Base URL: /api/ticket-formats
 */

// GET all ticket formats
router.get('/', authenticate, getAll);

// GET ticket format by ID
router.get('/:id', authenticate, getById);

// POST create new ticket format
router.post('/', authenticate, create);

// PUT update ticket format
router.put('/:id', authenticate, update);

// DELETE ticket format
router.delete('/:id', authenticate, deleteOne);

// PUT reactivate ticket format
router.put('/:id/reactivate', authenticate, reactivate);

module.exports = router;
