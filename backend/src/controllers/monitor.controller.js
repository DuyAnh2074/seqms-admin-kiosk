const monitorService = require('../services/monitor.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Monitor Controller
 * Handles HTTP requests for monitoring dashboard
 */

class MonitorController {
    /**
     * GET /api/monitor/stats
     * Get statistics for dashboard (count by status)
     */
    async getStats(req, res) {
        try {
            const { transaction_office_id, date } = req.query;

            if (!transaction_office_id) {
                return sendError(res, 'transaction_office_id is required', 400);
            }

            const stats = await monitorService.getStats(
                parseInt(transaction_office_id),
                date
            );

            sendSuccess(res, stats, 'Statistics retrieved successfully');
        } catch (error) {
            console.error('Get stats error:', error);
            sendError(res, error.message, 500);
        }
    }

    /**
     * GET /api/monitor/live-list
     * Get list of active tickets (waiting + serving)
     */
    async getLiveList(req, res) {
        try {
            const { transaction_office_id, date } = req.query;

            if (!transaction_office_id) {
                return sendError(res, 'transaction_office_id is required', 400);
            }

            const tickets = await monitorService.getLiveList(
                parseInt(transaction_office_id),
                date
            );

            sendSuccess(res, tickets, 'Live list retrieved successfully');
        } catch (error) {
            console.error('Get live list error:', error);
            sendError(res, error.message, 500);
        }
    }

    /**
     * GET /api/monitor/all-tickets
     * Get all tickets for detailed report
     */
    async getAllTickets(req, res) {
        try {
            const { transaction_office_id, date } = req.query;

            if (!transaction_office_id) {
                return sendError(res, 'transaction_office_id is required', 400);
            }

            const tickets = await monitorService.getAllTickets(
                parseInt(transaction_office_id),
                date
            );

            sendSuccess(res, tickets, 'All tickets retrieved successfully');
        } catch (error) {
            console.error('Get all tickets error:', error);
            sendError(res, error.message, 500);
        }
    }

    /**
     * GET /api/monitor/counter-sessions
     * Get list of active counter sessions with avg_waiting_time for each staff
     */
    async getCounterSessions(req, res) {
        try {
            const { transaction_office_id } = req.query;

            if (!transaction_office_id) {
                return sendError(res, 'transaction_office_id is required', 400);
            }

            const sessions = await monitorService.getCounterSessions(
                parseInt(transaction_office_id)
            );

            sendSuccess(res, sessions, 'Counter sessions retrieved successfully');
        } catch (error) {
            console.error('Get counter sessions error:', error);
            sendError(res, error.message, 500);
        }
    }
}

module.exports = new MonitorController();
