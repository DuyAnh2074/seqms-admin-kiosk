const counterService = require('../services/counter.service');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/counters
 * Get all counters
 * Query params: 
 *   ?service_id=<id> - filter by service
 *   ?office_id=<id> - filter by office
 */
const getAllCounters = async (req, res) => {
    try {
        const { service_id, office_id, active_only } = req.query;
        const counters = await counterService.getAllCounters(
            service_id ? parseInt(service_id) : null,
            office_id ? parseInt(office_id) : null,
            active_only === 'true'
        );
        return sendSuccess(res, counters, 'Counters retrieved successfully');
    } catch (error) {
        console.error('Error in getAllCounters:', error);
        return sendError(res, error.message, 500);
    }
};

/**
 * GET /api/counters/:id
 * Get counter by ID
 */
const getCounterById = async (req, res) => {
    try {
        const { id } = req.params;
        const counter = await counterService.getCounterById(parseInt(id));
        return sendSuccess(res, counter, 'Counter retrieved successfully');
    } catch (error) {
        console.error('Error in getCounterById:', error);
        return sendError(res, error.message, error.message === 'Counter not found' ? 404 : 500);
    }
};

/**
 * POST /api/counters
 * Create new counter
 */
const createCounter = async (req, res) => {
    try {
        const { code, name, led_number, transaction_office_id, services } = req.body;
        const normalizedCode = typeof code === 'string' ? code.trim() : code;
        const normalizedName = typeof name === 'string' ? name.trim() : name;

        // Validate required fields
        if (!normalizedCode || !normalizedName || !transaction_office_id) {
            return sendError(res, 'Missing required fields: code, name, transaction_office_id', 400);
        }

        const counter = await counterService.createCounter({
            code: normalizedCode,
            name: normalizedName,
            led_number,
            transaction_office_id,
            services,
        });

        return sendSuccess(res, counter, 'Counter created successfully', 201);
    } catch (error) {
        console.error('Error in createCounter:', error);
        return sendError(res, error.message, error.statusCode || 500);
    }
};

/**
 * PUT /api/counters/:id
 * Update counter
 */
const updateCounter = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, led_number, transaction_office_id, services } = req.body;
        const normalizedCode = typeof code === 'string' ? code.trim() : code;
        const normalizedName = typeof name === 'string' ? name.trim() : name;

        // Validate required fields
        if (!normalizedCode || !normalizedName || !transaction_office_id) {
            return sendError(res, 'Missing required fields: code, name, transaction_office_id', 400);
        }

        const counter = await counterService.updateCounter(parseInt(id), {
            code: normalizedCode,
            name: normalizedName,
            led_number,
            transaction_office_id,
            services,
        });

        return sendSuccess(res, counter, 'Counter updated successfully');
    } catch (error) {
        console.error('Error in updateCounter:', error);
        return sendError(res, error.message, error.statusCode || (error.message === 'Counter not found' ? 404 : 500));
    }
};

/**
 * DELETE /api/counters/:id
 * Deactivate counter
 */
const deleteCounter = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await counterService.deleteCounter(parseInt(id));
        return sendSuccess(res, result, 'Counter deactivated successfully');
    } catch (error) {
        console.error('Error in deleteCounter:', error);
        return sendError(res, error.message, error.message === 'Counter not found' ? 404 : 500);
    }
};

/**
 * PUT /api/counters/:id/reactivate
 * Reactivate counter
 */
const reactivateCounter = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await counterService.reactivateCounter(parseInt(id));
        return sendSuccess(res, result, 'Counter reactivated successfully');
    } catch (error) {
        console.error('Error in reactivateCounter:', error);
        if (error.statusCode) {
            return sendError(res, error.message, error.statusCode);
        }
        return sendError(res, error.message, error.message === 'Counter not found' ? 404 : 500);
    }
};

/**
 * GET /api/counters/status/:counterId
 * Check if counter has an active session
 * Returns: { hasActiveSession: boolean, sessionInfo?: {...} }
 */
const getCounterSessionStatus = async (req, res) => {
    try {
        const { counterId } = req.params;
        const status = await counterService.getCounterSessionStatus(parseInt(counterId));
        return sendSuccess(res, status, 'Counter session status retrieved successfully');
    } catch (error) {
        console.error('Error in getCounterSessionStatus:', error);
        return sendError(res, error.message, 500);
    }
};

module.exports = {
    getAllCounters,
    getCounterById,
    createCounter,
    updateCounter,
    deleteCounter,
    reactivateCounter,
    getCounterSessionStatus,
};
