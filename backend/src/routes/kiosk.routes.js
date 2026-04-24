const express = require('express');
const router = express.Router();
const kioskController = require('../controllers/kiosk.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * === ADMIN ROUTES ===
 */

// GET /api/kiosks - Lấy danh sách kiosks
router.get('/', authenticate, kioskController.getKiosks);

// POST /api/kiosks - Thêm kiosk mới
router.post('/', authenticate, kioskController.createKiosk);

// PUT /api/kiosks/:id - Cập nhật kiosk
router.put('/:id', authenticate, kioskController.updateKiosk);

// DELETE /api/kiosks/:id - Xóa kiosk
router.delete('/:id', authenticate, kioskController.deleteKiosk);

// PUT /api/kiosks/:id/reactivate - Khôi phục kiosk
router.put('/:id/reactivate', authenticate, kioskController.reactivateKiosk);

module.exports = router;
