const { sendSuccess, sendError } = require('../utils/response');
const CounterSession = require('../models/CounterSession');
const CounterPriorityService = require('../models/CounterPriorityService');
const {
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    reactivateService,
} = require('../services/service.service');

/**
 * GET /api/services
 * Get all services with ticket format details
 * Query: ?transaction_office_id=X (optional filter by office)
 * Query: ?active_only=true (optional - for Kiosk/Counter clients, only return active services)
 * Query: ?include_inactive_assigned=true (optional - for Office Config, include inactive services already assigned to office)
 */
const getAll = async (req, res, next) => {
    try {
        const { transaction_office_id, active_only, include_inactive_assigned } = req.query;
        const sessionToken = req.headers['x-session-token'];
        const isStaffCounterRequest = Boolean(sessionToken);
        const activeOnly = active_only === 'true' || isStaffCounterRequest;
        const includeInactiveAssigned = include_inactive_assigned === 'true';

        let services = await getAllServices(transaction_office_id, activeOnly, includeInactiveAssigned);

        if (isStaffCounterRequest) {
            const session = await CounterSession.findOne({
                where: {
                    session_token: sessionToken,
                    status: 'active',
                },
                attributes: ['counter_id'],
            });

            if (!session) {
                return sendError(res, 'Session not found or inactive', 401);
            }

            const mappings = await CounterPriorityService.findAll({
                where: { counter_id: session.counter_id },
                attributes: ['service_id'],
            });

            const allowedServiceIds = new Set(mappings.map((item) => Number(item.service_id)));
            services = services.filter((service) => allowedServiceIds.has(Number(service.id)));
        }

        sendSuccess(res, services, 'Services retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/services/:id
 * Get service by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const service = await getServiceById(id);
        sendSuccess(res, service, 'Service retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/services
 * Create new service
 */
const create = async (req, res, next) => {
    try {
        const { code, name, ticket_format_id, icon_url } = req.body;

        // Validation
        if (!code || !name) {
            return sendError(res, 'Code and name are required', 400);
        }

        const service = await createService(code, name, ticket_format_id, icon_url);
        sendSuccess(res, service, 'Service created successfully', 201);
    } catch (error) {
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 409);
        }
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * PUT /api/services/:id
 * Update service
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, ticket_format_id, icon_url } = req.body;

        // At least one field is required
        if (!name && ticket_format_id === undefined && !icon_url) {
            return sendError(res, 'At least one field is required for update', 400);
        }

        const service = await updateService(id, { name, ticket_format_id, icon_url });
        sendSuccess(res, service, 'Service updated successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('required')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * DELETE /api/services/:id
 * Deactivate service (soft delete - set is_active = false)
 */
const deleteOne = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteService(id);
        sendSuccess(res, result, 'Service deactivated successfully');
    } catch (error) {
        // Service not found
        if (error.message.includes('Không tìm thấy dịch vụ')) {
            return sendError(res, error.message, 404);
        }
        // Other errors
        next(error);
    }
};

/**
 * POST /api/services/:id/reactivate
 * Reactivate a deactivated service (set is_active = true)
 */
const reactivate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await reactivateService(id);
        sendSuccess(res, result, 'Service reactivated successfully');
    } catch (error) {
        if (error.message.includes('Không tìm thấy dịch vụ')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    deleteOne,
    reactivate,
};
