const eboardService = require('../services/eboard.service');

/**
 * Get all e-boards
 */
const getAllEBoards = async (req, res, next) => {
    try {
        const { office_id } = req.query;
        const eboards = await eboardService.getAllEBoards(office_id ? parseInt(office_id) : null);

        res.json({
            success: true,
            data: eboards,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get e-board by ID
 */
const getEBoardById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const eboard = await eboardService.getEBoardById(parseInt(id));

        if (!eboard) {
            return res.status(404).json({
                success: false,
                message: 'E-Board not found',
            });
        }

        res.json({
            success: true,
            data: eboard,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create new e-board
 */
const createEBoard = async (req, res, next) => {
    try {
        const eboard = await eboardService.createEBoard(req.body);

        res.status(201).json({
            success: true,
            message: 'E-Board created successfully',
            data: eboard,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update e-board
 */
const updateEBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const eboard = await eboardService.updateEBoard(parseInt(id), req.body);

        res.json({
            success: true,
            message: 'E-Board updated successfully',
            data: eboard,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deactivate e-board
 */
const deleteEBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await eboardService.deleteEBoard(parseInt(id));

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reactivate e-board
 */
const reactivateEBoard = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await eboardService.reactivateEBoard(parseInt(id));

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
};

/**
 * Delete e-board media item
 */
const deleteEBoardMedia = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const result = await eboardService.deleteEBoardMedia(parseInt(mediaId));

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllEBoards,
    getEBoardById,
    createEBoard,
    updateEBoard,
    deleteEBoard,
    reactivateEBoard,
    deleteEBoardMedia,
};
