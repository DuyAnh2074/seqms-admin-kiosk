const counterLiveService = require('../services/counter-live.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Counter Live Controller
 * Handles HTTP requests for counter staff operations
 */

class CounterLiveController {
    constructor() {
        this.getQueue = this.getQueue.bind(this);
        this.callTicket = this.callTicket.bind(this);
        this.ticketAction = this.ticketAction.bind(this);
        this.transferTicket = this.transferTicket.bind(this);
        this.toggleSession = this.toggleSession.bind(this);
        this.cancelTicket = this.cancelTicket.bind(this);
        this.getCurrentTicket = this.getCurrentTicket.bind(this);
        this.getSessionInfo = this.getSessionInfo.bind(this);
        this.addService = this.addService.bind(this);
        this.recallTicket = this.recallTicket.bind(this);
        this.updateSessionStatus = this.updateSessionStatus.bind(this);
    }

    isExpectedSessionError(error) {
        if (!error) return false;
        if (error.isExpectedSessionError) return true;

        const message = (error.message || '').toLowerCase();
        return message.includes('session not found')
            || message.includes('inactive session')
            || message.includes('phòng giao dịch đang tạm ngưng hoạt động');
    }

    handleExpectedError(res, error) {
        if (this.isExpectedSessionError(error)) {
            sendError(res, error.message, error.statusCode || 401);
            return true;
        }
        return false;
    }

    /**
     * GET /api/staff/queue
     * Get queue data (waiting, missed, booking lists)
     */
    async getQueue(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'] || req.query.session_token;

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const queueData = await counterLiveService.getQueueData(sessionToken);

            sendSuccess(res, queueData, 'Queue data retrieved successfully');
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Get queue error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/call
     * Call next ticket or specific ticket
     * Body: { action: 'NEXT' | 'CALL_SPECIFIC', transaction_id?: number }
     */
    async callTicket(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { action, transaction_id } = req.body;

            if (!action) {
                return sendError(res, 'Action is required (NEXT or CALL_SPECIFIC)', 400);
            }

            if (action === 'CALL_SPECIFIC' && !transaction_id) {
                return sendError(res, 'transaction_id is required for CALL_SPECIFIC action', 400);
            }

            const result = await counterLiveService.callTicket(sessionToken, action, transaction_id);

            sendSuccess(res, result.ticket, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            if (error.message !== 'Không có vé đang đợi') {
                console.error('Call ticket error:', error);
            }
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/ticket-action
     * Perform action on ticket (START, END, CANCEL, SKIP, RECALL)
     * Body: { transaction_id: number, action: string, note?: string }
     */
    async ticketAction(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { transaction_id, action, note } = req.body;

            if (!transaction_id) {
                return sendError(res, 'transaction_id is required', 400);
            }

            if (!action) {
                return sendError(res, 'action is required (START, END, CANCEL, SKIP, RECALL)', 400);
            }

            const result = await counterLiveService.ticketAction(sessionToken, transaction_id, action, note);

            sendSuccess(res, result.ticket, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Ticket action error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/transfer
     * Transfer ticket to another service or counter
     * Body: { transaction_id: number, target_service_id?: number, target_counter_id?: number, note?: string }
     */
    async transferTicket(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { transaction_id, target_service_id, target_counter_id, note } = req.body;

            if (!transaction_id) {
                return sendError(res, 'transaction_id is required', 400);
            }

            if (!target_service_id && !target_counter_id) {
                return sendError(res, 'Either target_service_id or target_counter_id is required', 400);
            }

            const result = await counterLiveService.transferTicket(
                sessionToken,
                transaction_id,
                target_service_id,
                target_counter_id,
                note
            );

            sendSuccess(res, result.ticket, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Transfer ticket error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/toggle-session
     * Pause or resume counter session
     */
    async toggleSession(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const result = await counterLiveService.toggleSessionStatus(sessionToken);

            sendSuccess(res, { status: result.status }, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Toggle session error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/cancel
     * Cancel a ticket
     */
    async cancelTicket(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { transaction_id, note } = req.body;

            if (!transaction_id) {
                return sendError(res, 'transaction_id is required', 400);
            }

            const result = await counterLiveService.ticketAction(
                sessionToken,
                transaction_id,
                'CANCEL',
                note
            );

            sendSuccess(res, result.ticket, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Cancel ticket error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * GET /api/staff/current-ticket
     * Get currently serving ticket for this session
     */
    async getCurrentTicket(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'] || req.query.session_token;

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const queueData = await counterLiveService.getQueueData(sessionToken);

            sendSuccess(res, queueData.currentTicket, 'Current ticket retrieved successfully');
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Get current ticket error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * GET /api/staff/session-info
     * Get current session information
     */
    async getSessionInfo(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'] || req.query.session_token;

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const sessionInfo = await counterLiveService.getSessionInfo(sessionToken);

            sendSuccess(res, {
                counter_id: sessionInfo.counter_id,
                transaction_office_id: sessionInfo.transaction_office_id,
                user_id: sessionInfo.user_id,
                counter: sessionInfo.Counter,
            }, 'Session info retrieved successfully');
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Get session info error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/add-service
     * Add a service to the current ticket - NEW LOGIC: Split Transaction
     * 
     * This API now creates a NEW transaction instead of updating the current one.
     * Old transaction is marked as 'completed', new transaction starts with status 'serving'.
     * 
     * Body: { transaction_id: number, new_service_id: number }
     * 
     * Response includes:
     * - ticket: New transaction object (with NEW ID)
     * - old_transaction_id: ID of completed transaction
     * - new_transaction_id: ID of new transaction
     * 
     * IMPORTANT FOR FRONTEND:
     * - Update currentTransactionId to new_transaction_id
     * - Reset timer using new started_at timestamp
     */
    async addService(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { transaction_id, new_service_id } = req.body;

            if (!transaction_id) {
                return sendError(res, 'transaction_id is required', 400);
            }

            if (!new_service_id) {
                return sendError(res, 'new_service_id is required', 400);
            }

            const result = await counterLiveService.addService(
                sessionToken,
                transaction_id,
                new_service_id
            );

            // Return full result object including old_transaction_id and new_transaction_id
            sendSuccess(res, result, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Add service error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/recall
     * Recall a ticket (re-announce on TV/speakers)
     * Body: { transaction_id: number }
     */
    async recallTicket(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { transaction_id } = req.body;

            if (!transaction_id) {
                return sendError(res, 'transaction_id is required', 400);
            }

            const result = await counterLiveService.recallTicket(sessionToken, transaction_id);

            sendSuccess(res, result, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Recall ticket error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }

    /**
     * POST /api/staff/session/status
     * Update session status (pause/resume counter)
     * Body: { status: 'active' | 'paused' }
     */
    async updateSessionStatus(req, res) {
        try {
            const sessionToken = req.headers['x-session-token'];

            if (!sessionToken) {
                return sendError(res, 'Session token is required', 400);
            }

            const { status } = req.body;

            if (!status) {
                return sendError(res, 'status is required (active or paused)', 400);
            }

            const result = await counterLiveService.updateSessionStatus(sessionToken, status);

            sendSuccess(res, result, result.message);
        } catch (error) {
            if (this.handleExpectedError(res, error)) {
                return;
            }
            console.error('Update session status error:', error);
            sendError(res, error.message, error.statusCode || 500);
        }
    }
}

module.exports = new CounterLiveController();
