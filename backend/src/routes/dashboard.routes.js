const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply authentication middleware to all dashboard routes
router.use(authenticate);

/**
 * GET /api/dashboard/analytics
 * Get dashboard analytics data with charts
 * Query params: month, year (optional, defaults to current month/year)
 */
router.get('/analytics', dashboardController.getAnalytics);

module.exports = router;
