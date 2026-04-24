const express = require('express');
const router = express.Router();
const counterController = require('../controllers/counter.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// All routes require authentication

// Counter routes
router.get('/', authenticate, counterController.getAllCounters);
router.get('/status/:counterId', authenticate, counterController.getCounterSessionStatus);
router.get('/:id', authenticate, counterController.getCounterById);
router.post('/', authenticate, counterController.createCounter);
router.put('/:id', authenticate, counterController.updateCounter);
router.delete('/:id', authenticate, counterController.deleteCounter);
router.put('/:id/reactivate', authenticate, counterController.reactivateCounter);

module.exports = router;
