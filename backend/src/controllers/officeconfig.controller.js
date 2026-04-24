const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllOfficeConfigs,
    getOfficeConfigDetails,
    saveOfficeConfig,
    deleteOfficeConfig,
} = require('../services/officeconfig.service');

/**
 * GET /api/office-configs
 * Get list of all office configurations with summary
 */
const getConfigs = async (req, res, next) => {
    try {
        const configs = await getAllOfficeConfigs();
        sendSuccess(res, configs, 'Office configurations retrieved successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to fetch office configurations', 500);
    }
};

/**
 * GET /api/office-configs/:officeId/details
 * Get specific office configuration details
 */
const getConfigDetails = async (req, res, next) => {
    try {
        const { officeId } = req.params;

        if (!officeId) {
            return sendError(res, 'Office ID is required', 400);
        }

        const config = await getOfficeConfigDetails(officeId);
        sendSuccess(res, config, 'Office configuration details retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        return sendError(res, error.message || 'Failed to fetch configuration details', 500);
    }
};

/**
 * POST /api/office-configs/:officeId
 * Save office configuration with transaction
 * Body: { 
 *   configs: { waiting_warning_minutes, ..., serving_overdue_minutes }, 
 *   service_ids: [1, 5, 9],
 *   service_group_ids: [2, 4]
 * }
 */
const saveConfig = async (req, res, next) => {
    try {
        const { officeId } = req.params;
        const { configs, service_ids, service_group_ids = [] } = req.body;

        if (!officeId) {
            return sendError(res, 'Office ID is required', 400);
        }

        if (!configs || !service_ids || !Array.isArray(service_ids)) {
            return sendError(res, 'configs and service_ids (array) are required in request body', 400);
        }

        const updatedConfig = await saveOfficeConfig(officeId, configs, service_ids, service_group_ids);
        sendSuccess(res, updatedConfig, 'Office configuration saved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        // Handle validation error (service/group in use)
        if (error.message.includes('Không thể gỡ cấu hình')) {
            return sendError(res, error.message, 400);
        }
        if (error.message.includes('Không thể thay đổi cấu hình. Phòng giao dịch này đang bị vô hiệu hóa.')) {
            return sendError(res, error.message, 400);
        }
        if (error.message.includes('Invalid input')) {
            return sendError(res, error.message, 400);
        }
        return sendError(res, error.message || 'Failed to save configuration', 500);
    }
};

/**
 * DELETE /api/office-configs/:officeId
 * Delete office configuration and all related data
 */
const deleteConfig = async (req, res, next) => {
    try {
        const { officeId } = req.params;

        if (!officeId) {
            return sendError(res, 'Office ID is required', 400);
        }

        await deleteOfficeConfig(officeId);
        sendSuccess(res, null, 'Office configuration deleted successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        // Handle validation error (service/group in use)
        if (error.message.includes('Không thể xóa cấu hình')) {
            return sendError(res, error.message, 400);
        }
        return sendError(res, error.message || 'Failed to delete configuration', 500);
    }
};

module.exports = {
    getConfigs,
    getConfigDetails,
    saveConfig,
    deleteConfig,
};
