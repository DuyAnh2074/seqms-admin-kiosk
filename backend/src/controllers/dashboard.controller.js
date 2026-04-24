const dashboardService = require('../services/dashboard.service');

/**
 * GET /api/dashboard/analytics
 * Get dashboard analytics data with 4 charts
 * Query params: month, year (defaults to current month/year)
 */
async function getAnalytics(req, res, next) {
    try {
        const now = new Date();
        const month = parseInt(req.query.month) || now.getMonth() + 1;
        const year = parseInt(req.query.year) || now.getFullYear();

        // Get analytics data from service
        const analyticsData = await dashboardService.getAnalyticsData(month, year);

        res.json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        next(error);
    }
}

module.exports = {
    getAnalytics,
};
