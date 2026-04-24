const { response } = require('../utils/response');
const kioskService = require('../services/kiosk.service');

/**
 * === ADMIN APIS ===
 */

/**
 * GET /api/kiosks - Lấy danh sách kiosks (Admin)
 * Returns concatenated service group names and service names for display
 */
const getKiosks = async (req, res) => {
    try {
        const kiosks = await kioskService.getAllKiosks();
        return response(res, 200, kiosks, 'Danh sách kiosks');
    } catch (error) {
        console.error('Error in getKiosks:', error);
        return response(res, 500, null, error.message);
    }
};

/**
 * CREATE /api/kiosks - Thêm kiosk mới
 * Body: { transaction_office_id, service_group_ids[], service_ids[], name, code }
 */
const createKiosk = async (req, res) => {
    try {
        const createdKiosk = await kioskService.createKiosk(req.body);
        return response(res, 201, createdKiosk, 'Kiosk đã được thêm thành công');
    } catch (error) {
        console.error('Error in createKiosk:', error);
        return response(res, 400, null, error.message);
    }
};

/**
 * UPDATE /api/kiosks/:id - Cập nhật kiosk
 */
const updateKiosk = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedKiosk = await kioskService.updateKiosk(id, req.body);
        return response(res, 200, updatedKiosk, 'Kiosk đã được cập nhật thành công');
    } catch (error) {
        console.error('Error in updateKiosk:', error);
        const statusCode = error.message.includes('không tồn tại') ? 404 : 400;
        return response(res, statusCode, null, error.message);
    }
};

/**
 * DELETE /api/kiosks/:id - Vô hiệu hóa kiosk
 */
const deleteKiosk = async (req, res) => {
    try {
        const { id } = req.params;
        await kioskService.deleteKiosk(id);
        return response(res, 200, null, 'Kiosk đã được vô hiệu hóa thành công');
    } catch (error) {
        console.error('Error in deleteKiosk:', error);
        const statusCode = error.message.includes('không tồn tại') ? 404 : 500;
        return response(res, statusCode, null, error.message);
    }
};

/**
 * PUT /api/kiosks/:id/reactivate - Khôi phục kiosk
 */
const reactivateKiosk = async (req, res) => {
    try {
        const { id } = req.params;
        await kioskService.reactivateKiosk(id);
        return response(res, 200, null, 'Kiosk đã được khôi phục thành công');
    } catch (error) {
        console.error('Error in reactivateKiosk:', error);
        const statusCode = error.statusCode || (error.message.includes('không tồn tại') ? 404 : 500);
        return response(res, statusCode, null, error.message);
    }
};

/**
 * === CLIENT APIs (Public) ===
 */

/**
 * GET /kiosk-services?code=KIOSK_CODE (Public API)
 * Lấy danh sách dịch vụ cho kiosk client
 * Returns nested structure: Kiosk -> Service Groups -> Services
 */
const getKioskServices = async (req, res) => {
    try {
        const { code } = req.query;
        const kioskData = await kioskService.getKioskServicesByCode(code);

        // Return custom format as per requirements
        return res.status(200).json({
            data: kioskData,
            status: 'success',
        });
    } catch (error) {
        console.error('Error in getKioskServices:', error);
        let statusCode = error.statusCode || 400;
        if (error.message.includes('không tồn tại')) {
            statusCode = 404;
        }
        return res.status(statusCode).json({
            data: null,
            status: 'error',
            message: error.message,
        });
    }
};

module.exports = {
    getKiosks,
    createKiosk,
    updateKiosk,
    deleteKiosk,
    reactivateKiosk,
    getKioskServices,
};
