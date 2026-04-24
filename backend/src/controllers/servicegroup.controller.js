const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllServiceGroups,
    getServiceGroupById,
    createServiceGroup,
    updateServiceGroup,
    deleteServiceGroup,
    reactivateServiceGroup,
} = require('../services/servicegroup.service');


/**
 * GET /api/service-groups
 * Get all service groups with their services
 * Query: ?transaction_office_id=X (optional filter by office)
 * Query: ?active_only=true (optional - for Kiosk/Counter clients, only return active groups)
 * Query: ?include_inactive_assigned=true (optional - for Office Config, include inactive groups already assigned to office)
 */
const getAll = async (req, res, next) => {
    try {
        const { transaction_office_id, active_only, include_inactive_assigned } = req.query;
        const activeOnly = active_only === 'true';
        const includeInactiveAssigned = include_inactive_assigned === 'true';
        const groups = await getAllServiceGroups(transaction_office_id, activeOnly, includeInactiveAssigned);
        sendSuccess(res, groups, 'Service groups retrieved successfully');
    } catch (error) {
        next(error);
    };
};

/**
 * GET /api/service-groups/:id
 * Get service group by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const group = await getServiceGroupById(id);
        sendSuccess(res, group, 'Service group retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/service-groups
 * Create new service group
 */
const create = async (req, res, next) => {
    try {
        const { code, name, icon_url, service_ids } = req.body;

        // Validation
        if (!code || !name) {
            return sendError(res, 'Code and name are required', 400);
        }

        if (!service_ids || service_ids.length === 0) {
            return sendError(res, 'At least one service must be selected', 400);
        }

        const newGroup = await createServiceGroup({
            code,
            name,
            icon_url,
            service_ids
        });

        sendSuccess(res, newGroup, 'Service group created successfully', 201);
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/service-groups/:id
 * Update service group
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, icon_url, service_ids } = req.body;

        // Validation
        if (!name) {
            return sendError(res, 'Name is required', 400);
        }

        if (!service_ids || service_ids.length === 0) {
            return sendError(res, 'At least one service must be selected', 400);
        }

        const updatedGroup = await updateServiceGroup(id, {
            name,
            icon_url,
            service_ids
        });

        sendSuccess(res, updatedGroup, 'Service group updated successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * DELETE /api/service-groups/:id
 * Deactivate service group (soft delete - set is_active = false)
 */
const deleteGroup = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteServiceGroup(id);
        sendSuccess(res, result, 'Service group deactivated successfully');
    } catch (error) {
        // Handle not found errors
        if (error.message.includes('Không tìm thấy')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/service-groups/:id/reactivate
 * Reactivate a deactivated service group
 */
const reactivate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await reactivateServiceGroup(id);
        sendSuccess(res, result, 'Service group reactivated successfully');
    } catch (error) {
        if (error.message.includes('Không tìm thấy')) {
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
    deleteGroup,
    reactivate
};
