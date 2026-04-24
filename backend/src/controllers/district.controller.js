const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllDistricts,
    getDistrictById,
    createDistrict,
    updateDistrict,
    deleteDistrict,
} = require('../services/district.service');

/**
 * GET /api/districts
 * Get all districts with province information
 */
const getAll = async (req, res, next) => {
    try {
        const districts = await getAllDistricts();
        sendSuccess(res, districts, 'Districts retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/districts/:id
 * Get district by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const district = await getDistrictById(id);
        sendSuccess(res, district, 'District retrieved successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

/**
 * POST /api/districts
 * Create new district
 */
const create = async (req, res, next) => {
    try {
        const { province_id, code, name } = req.body;

        // Validation
        if (!province_id || !code || !name) {
            return sendError(res, 'Province ID, code, and name are required', 400);
        }

        const district = await createDistrict(province_id, code, name);
        sendSuccess(res, district, 'District created successfully', 201);
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
 * PUT /api/districts/:id
 * Update district
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { province_id, code, name } = req.body;

        // At least one field is required
        if (!province_id && !code && !name) {
            return sendError(res, 'At least one field is required for update', 400);
        }

        const district = await updateDistrict(id, { province_id, code, name });
        sendSuccess(res, district, 'District updated successfully');
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
 * DELETE /api/districts/:id
 * Delete district
 */
const deleteOne = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteDistrict(id);
        sendSuccess(res, result, 'District deleted successfully');
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
