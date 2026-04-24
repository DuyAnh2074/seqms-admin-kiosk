const publicService = require('../services/public.service');

/**
 * Get EBoard configuration by code
 * GET /api/public/eboard-config?code=BOARD_CODE
 */
const getEBoardConfig = async (req, res, next) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Board code is required',
            });
        }

        const config = await publicService.getEBoardConfigByCode(code);

        res.json({
            success: true,
            data: config,
        });
    } catch (error) {
        if (error.statusCode === 403) {
            return res.status(403).json({
                success: false,
                message: error.message,
            });
        }
        if (error.message === 'E-Board not found') {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
};

/**
 * Get monitor tickets for display
 * GET /api/public/monitor/tickets?date=YYYY-MM-DD&code=BOARD_CODE
 */
const getMonitorTickets = async (req, res, next) => {
    try {
        const { date, code } = req.query;

        let counterIds = null;
        let officeId = null;

        if (code) {
            try {
                const config = await publicService.getEBoardConfigByCode(code);
                counterIds = config.counter_ids;
                officeId = config.transaction_office_id;
            } catch (error) {
                if (error.statusCode === 403) {
                    return res.status(403).json({
                        success: false,
                        message: error.message,
                    });
                }
                return res.status(404).json({
                    success: false,
                    message: `Board with code '${code}' not found`,
                });
            }
        }

        const tickets = await publicService.getMonitorTickets(date, officeId, counterIds);

        res.json({
            success: true,
            data: tickets,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get complete E-Board data for TV display
 * GET /api/public/eboard-data?code=BOARD_CODE
 *
 * Returns:
 * - board_info: Board metadata
 * - serving_list: Array of currently serving tickets (max 6)
 * - last_called_ticket: Most recent called ticket
 * - media: Media playlist for slideshow
 */
const getEBoardData = async (req, res, next) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Board code is required',
            });
        }

        const data = await publicService.getEBoardDataByCode(code);

        // Convert relative media URLs to absolute URLs
        if (data.media && Array.isArray(data.media)) {
            const protocol = req.protocol || 'http';
            const host = req.get('host') || 'localhost:5000';
            const baseUrl = `${protocol}://${host}`;

            data.media = data.media.map((m) => ({
                ...m,
                file_url: m.file_url.startsWith('http')
                    ? m.file_url
                    : `${baseUrl}${m.file_url}`,
            }));
        }

        res.json(data);
    } catch (error) {
        if (error.statusCode === 403) {
            return res.status(403).json({
                success: false,
                message: error.message,
            });
        }
        if (error.message === 'E-Board not found') {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
};

module.exports = {
    getEBoardConfig,
    getMonitorTickets,
    getEBoardData,
};