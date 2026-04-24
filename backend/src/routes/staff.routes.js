const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const {
    getAvailableCounters,
    startSession,
    endSession,
    endSessionByToken,
    getCurrentSession,
    getUserOffice,
    restoreSession,
    assignCounter,
} = require('../controllers/staff.controller');

const router = express.Router();

/**
 * POST /api/staff/session/end-by-token
 * End session by token only (used when JWT is expired)
 * No authentication middleware needed as it uses x-counter-session-token
 */
router.post('/session/end-by-token', endSessionByToken);

// All other staff routes require authentication
router.use(authenticate);
router.use(authorize(['staff']));

/**
 * GET /api/staff/office
 * Get current user's office info
 */
router.get('/office', getUserOffice);

/**
 * GET /api/staff/counters
 * Get available counters for the current user (staff)
 */
router.get('/counters', getAvailableCounters);

/**
 * POST /api/staff/assign-counter
 * Assign a counter to the current staff member with race condition handling
 * Body: { counter_id: number }
 * Response on conflict (409): { success: false, message: "...", data: { counter_id, occupied_by, occupied_since } }
 */
router.post('/assign-counter', assignCounter);

/**
 * POST /api/staff/session
 * Start a new counter session
 * Body: { counter_id: number }
 */
router.post('/session', startSession);

/**
 * GET /api/staff/session
 * Get current active session
 */
router.get('/session', getCurrentSession);

/**
 * GET /api/staff/session/restore
 * Restore session from session_token
 * Header: x-counter-session-token OR Query: ?session_token=xxx
 */
router.get('/session/restore', restoreSession);

/**
 * POST /api/staff/session/end
 * End current session
 */
router.post('/session/end', endSession);

module.exports = router;
