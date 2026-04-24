const express = require('express');
const router = express.Router();
const eboardController = require('../controllers/eboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * === E-BOARD ROUTES (Admin) ===
 * All routes require authentication
 */

// GET /api/eboards - Get all e-boards
router.get('/', authenticate, eboardController.getAllEBoards);

// GET /api/eboards/:id - Get e-board by ID
router.get('/:id', authenticate, eboardController.getEBoardById);

// POST /api/eboards - Create new e-board
router.post('/', authenticate, eboardController.createEBoard);

// PUT /api/eboards/:id - Update e-board
router.put('/:id', authenticate, eboardController.updateEBoard);

// DELETE /api/eboards/media/:mediaId - Delete e-board media item (MUST BE BEFORE /:id route)
router.delete('/media/:mediaId', authenticate, eboardController.deleteEBoardMedia);

// DELETE /api/eboards/:id - Delete e-board
router.delete('/:id', authenticate, eboardController.deleteEBoard);

// PUT /api/eboards/:id/reactivate - Reactivate e-board
router.put('/:id/reactivate', authenticate, eboardController.reactivateEBoard);

module.exports = router;
