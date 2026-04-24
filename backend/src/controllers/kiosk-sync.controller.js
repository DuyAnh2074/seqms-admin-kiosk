const kioskSyncService = require('../services/kiosk-sync.service');
const { emitOfficeQueueUpdate } = require('../socket');

/**
 * POST /api/public/kiosk-sync
 * Endpoint nhận dữ liệu đồng bộ từ Kiosk
 */
const syncKioskData = async (req, res) => {
    try {
        const payload = req.body;

        // Validate payload structure
        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid payload format',
                error_code: 'INVALID_PAYLOAD',
            });
        }

        // Process sync
        const result = await kioskSyncService.processKioskSync(payload);

        // Emit queue update to all counters in the office so they can refetch
        const officeId = result?.data?.transaction_office_id;
        if (officeId) {
            emitOfficeQueueUpdate(officeId, {
                reason: 'kiosk-sync',
                ticket_number: result.data.ticket_number,
            });
        }

        // Return success response
        res.status(result.data.existing ? 200 : 201).json({
            success: true,
            message: result.message,
            data: result.data,
        });
    } catch (error) {
        console.error('Kiosk sync error:', error);

        // Determine error status code
        let statusCode = 500;
        let errorCode = 'SYNC_FAILED';

        if (error.message.includes('not found')) {
            statusCode = 404;
            errorCode = 'RESOURCE_NOT_FOUND';
        } else if (error.statusCode === 403 || error.message.includes('Phòng giao dịch đang tạm ngưng hoạt động')) {
            statusCode = 403;
            errorCode = 'OFFICE_INACTIVE';
        } else if (error.message.includes('Missing required')) {
            statusCode = 400;
            errorCode = 'MISSING_REQUIRED_FIELDS';
        }

        res.status(statusCode).json({
            success: false,
            message: error.message,
            error_code: errorCode,
        });
    }
};

module.exports = {
    syncKioskData,
};
