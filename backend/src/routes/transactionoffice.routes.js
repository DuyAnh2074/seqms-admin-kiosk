const express = require('express');
const {
    getAll,
    getById,
    create,
    update,
    deleteOne,
    reactivate,
    getDistrictsByProvinceHandler,
} = require('../controllers/transactionoffice.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Transaction Office Routes
 * Base path: /api/transaction-offices
 */

// GET all transaction offices
router.get('/', authenticate, getAll);

// GET districts filtered by province (for cascading dropdown)
// Note: This route must come before /:id to avoid conflict
router.get('/districts/by-province/:province_id', authenticate, getDistrictsByProvinceHandler);

// GET transaction office by ID
router.get('/:id', authenticate, getById);

// POST create new transaction office
router.post('/', authenticate, create);

// PUT update transaction office
router.put('/:id', authenticate, update);

// DELETE transaction office (soft delete with cascade deactivation)
router.delete('/:id', authenticate, deleteOne);

// POST reactivate transaction office
router.post('/:id/reactivate', authenticate, reactivate);

module.exports = router;
