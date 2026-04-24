const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// All reports routes require authentication
router.use(authMiddleware.authenticate);

// GET /api/reports/transactions - Get transaction reports with filters
router.get('/transactions', reportsController.getTransactionReports);

// GET /api/reports/export - Export transaction reports to Excel
router.get('/export', reportsController.exportTransactionReports);

// GET /api/reports/summary - Get summary statistics
router.get('/summary', reportsController.getSummaryStatistics);

module.exports = router;
