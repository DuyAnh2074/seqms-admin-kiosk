const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllProvinces,
    getProvinceById,
    createProvince,
    updateProvince,
    deleteProvince,
} = require('../services/province.service');

/**
 * GET /api/provinces
 * Get all provinces
 */
const getAll = async (req, res, next) => {
    try {
        const provinces = await getAllProvinces();
        sendSuccess(res, provinces, 'Provinces retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/provinces/:id
 * Get province by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const province = await getProvinceById(id);
        sendSuccess(res, province, 'Province retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/provinces
 * Create new province
 */
const create = async (req, res, next) => {
    try {
        const { code, name } = req.body;

        // Validation
        if (!code || !name) {
            return sendError(res, 'Code and name are required', 400);
        }

        const province = await createProvince(code, name);
        sendSuccess(res, province, 'Province created successfully', 201);
    } catch (error) {
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 409);
        }
        next(error);
    }
};

/**
 * PUT /api/provinces/:id
 * Update province
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { code, name } = req.body;

        // At least one field is required
        if (!code && !name) {
            return sendError(res, 'At least one field is required for update', 400);
        }

        const province = await updateProvince(id, { code, name });
        sendSuccess(res, province, 'Province updated successfully');
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
 * DELETE /api/provinces/:id
 * Delete province
 */
const deleteOne = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteProvince(id);
        sendSuccess(res, result, 'Province deleted successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('Cannot delete')) {
            return sendError(res, error.message, 409);
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
};
