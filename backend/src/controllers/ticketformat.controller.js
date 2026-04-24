const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllTicketFormats,
    getTicketFormatById,
    createTicketFormat,
    updateTicketFormat,
    deleteTicketFormat,
    reactivateTicketFormat,
} = require('../services/ticketformat.service');

/**
 * GET /api/ticket-formats
 * Get all ticket formats
 */
const getAll = async (req, res, next) => {
    try {
        const formats = await getAllTicketFormats();
        sendSuccess(res, formats, 'Ticket formats retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/ticket-formats/:id
 * Get ticket format by ID
 */
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const format = await getTicketFormatById(id);
        sendSuccess(res, format, 'Ticket format retrieved successfully');
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/ticket-formats
 * Create new ticket format
 */
const create = async (req, res, next) => {
    try {
        const { code, template_format, min_number, max_number } = req.body;

        // Validation
        if (!code || !template_format) {
            return sendError(res, 'Code and template format are required', 400);
        }

        if (min_number === undefined || max_number === undefined) {
            return sendError(res, 'Min number and max number are required', 400);
        }

        const format = await createTicketFormat(code, template_format, min_number, max_number);
        sendSuccess(res, format, 'Ticket format created successfully', 201);
    } catch (error) {
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 409);
        }
        if (error.message.includes('must be less than')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * PUT /api/ticket-formats/:id
 * Update ticket format
 */
const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { template_format, min_number, max_number } = req.body;

        if (!template_format && min_number === undefined && max_number === undefined) {
            return sendError(res, 'At least one field must be provided to update', 400);
        }

        const format = await updateTicketFormat(id, {
            templateFormat: template_format,
            minNumber: min_number,
            maxNumber: max_number,
        });

        sendSuccess(res, format, 'Ticket format updated successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('must be less than')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * DELETE /api/ticket-formats/:id
 * Deactivate ticket format
 */
const deleteOne = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await deleteTicketFormat(id);
        sendSuccess(res, result, 'Ticket format deactivated successfully');
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('Không thể vô hiệu hóa Mẫu vé này')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

/**
 * PUT /api/ticket-formats/:id/reactivate
 * Reactivate ticket format
 */
const reactivate = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await reactivateTicketFormat(id);
        sendSuccess(res, result, 'Ticket format reactivated successfully');
    } catch (error) {
        if (error.message.includes('Không tìm thấy mẫu vé')) {
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
