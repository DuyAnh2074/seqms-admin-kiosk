const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitor.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Monitor Routes
 * Routes for real-time monitoring dashboard
 */

// Get statistics (count by status)
router.get('/stats', authenticate, monitorController.getStats);

// Get live list (waiting + serving tickets)
router.get('/live-list', authenticate, monitorController.getLiveList);

// Get all tickets for detailed report
router.get('/all-tickets', authenticate, monitorController.getAllTickets);

// Get counter sessions with avg_waiting_time for staff
router.get('/counter-sessions', authenticate, monitorController.getCounterSessions);

module.exports = router;
