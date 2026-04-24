const express = require('express');
const router = express.Router();
const kioskController = require('../controllers/kiosk.controller');
const kioskSyncController = require('../controllers/kiosk-sync.controller');
const publicController = require('../controllers/public.controller');

/**
 * === PUBLIC ROUTES (No authentication required) ===
 */

// GET /api/public/kiosk-services?code=KIOSK_CODE
// Lấy danh sách dịch vụ cho kiosk client
router.get('/kiosk-services', kioskController.getKioskServices);

// POST /api/public/kiosk-sync
// Đồng bộ dữ liệu từ Kiosk về Server
router.post('/kiosk-sync', kioskSyncController.syncKioskData);

// GET /api/public/eboard-config?code=BOARD_CODE
// Lấy cấu hình e-board cho TV Client
router.get('/eboard-config', publicController.getEBoardConfig);

// GET /api/public/eboard-data?code=BOARD_CODE
// Lấy dữ liệu đầy đủ cho màn hình TV: board info + serving tickets + last called + media
router.get('/eboard-data', publicController.getEBoardData);

// GET /api/public/monitor/tickets?date=YYYY-MM-DD&code=BOARD_CODE
// Lấy danh sách vé phục vụ/đang gọi cho TV Monitor
router.get('/monitor/tickets', publicController.getMonitorTickets);

module.exports = router;