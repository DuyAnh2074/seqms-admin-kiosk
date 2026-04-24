const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllTransactionOffices,
    getTransactionOfficeById,
    createTransactionOffice,
    updateTransactionOffice,
    deleteTransactionOffice,
    reactivateTransactionOffice,
    getDistrictsByProvince,
} = require('../services/transactionoffice.service');

/**
 * GET /api/transaction-offices
 * Get all transaction offices with district and province information
 * Query: ?district_id=X (optional filter)
 * Query: ?active_only=true (optional - for Kiosk/Counter clients, only return active offices)
 */
const getAll = async (req, res, next) => {
    try {
        const { district_id, active_only } = req.query;
        const activeOnly = active_only === 'true';
        const offices = await getAllTransactionOffices(district_id, activeOnly);
        sendSuccess(res, offices, 'Transaction offices retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/transaction-offices/:id
 * Get transaction office by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const office = await getTransactionOfficeById(id);
        sendSuccess(res, office, 'Transaction office retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/transaction-offices
 * Create new transaction office
 * Body: { district_id, code, name, address?, latitude?, longitude? }
 */
const create = async (req, res, next) => {
    try {
        const { district_id, code, name, address, latitude, longitude } = req.body;

        // Validation
        if (!district_id || !code || !name) {
            return sendError(res, 'District ID, code, and name are required', 400);
        }

        const office = await createTransactionOffice(
            district_id,
            code,
            name,
            address,
            latitude,
            longitude
        );

        sendSuccess(res, office, 'Transaction office created successfully', 201);
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 409);
        }
        next(error);
    }
};

/**
 * PUT /api/transaction-offices/:id
 * Update transaction office
 * Body: { district_id?, code?, name?, address?, latitude?, longitude?, is_active? }
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { district_id, code, name, address, latitude, longitude, is_active } = req.body;

        // At least one field is required for update
        if (district_id === undefined && code === undefined && name === undefined &&
            address === undefined && latitude === undefined && longitude === undefined &&
            is_active === undefined) {
            return sendError(res, 'At least one field is required for update', 400);
        }

        const office = await updateTransactionOffice(id, {
            district_id,
            code,
            name,
            address,
            latitude,
            longitude,
            is_active
        });

        sendSuccess(res, office, 'Transaction office updated successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 409);
        }
        next(error);
    }
};

/**
 * DELETE /api/transaction-offices/:id
 * Deactivate transaction office and cascade deactivate all related devices
 */
const deleteOne = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteTransactionOffice(id);
        sendSuccess(res, result, 'Transaction office deactivated successfully');
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('Không tìm thấy')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/transaction-offices/:id/reactivate
 * Reactivate a deactivated transaction office
 */
const reactivate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await reactivateTransactionOffice(id);
        sendSuccess(res, result, 'Transaction office reactivated successfully');
    } catch (error) {
        if (error.message.includes('not found') || error.message.includes('Không tìm thấy')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * GET /api/transaction-offices/districts/by-province/:province_id
 * Get districts filtered by province_id (for cascading dropdown)
 */
const getDistrictsByProvinceHandler = async (req, res, next) => {
    try {
        const { province_id } = req.params;

        if (!province_id) {
            return sendError(res, 'Province ID is required', 400);
        }

        const districts = await getDistrictsByProvince(province_id);
        sendSuccess(res, districts, 'Districts retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
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
    getDistrictsByProvinceHandler,
};
