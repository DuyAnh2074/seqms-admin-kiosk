const express = require('express');
const router = express.Router();
const counterLiveController = require('../controllers/counter-live.controller');

/**
 * Counter Live Routes
 * All routes require session token in header: x-session-token
 * 
 * These routes are for staff members who have logged in at a counter
 * and have an active counter session
 */

// Get queue data (waiting, missed, booking)
router.get('/queue', counterLiveController.getQueue);

// Get session information
router.get('/session-info', counterLiveController.getSessionInfo);

// Get current serving ticket
router.get('/current-ticket', counterLiveController.getCurrentTicket);

// Call next ticket or specific ticket
router.post('/call', counterLiveController.callTicket);

// Perform action on ticket (START, END, CANCEL, SKIP, RECALL)
router.post('/ticket-action', counterLiveController.ticketAction);

// Cancel ticket (shortcut for CANCEL action)
router.post('/cancel', counterLiveController.cancelTicket);

// Transfer ticket to another service or counter
router.post('/transfer', counterLiveController.transferTicket);

// Add service to current ticket (changes service and resets timer)
router.post('/add-service', counterLiveController.addService);

// Recall ticket (re-announce on TV/speakers)
router.post('/recall', counterLiveController.recallTicket);

// Update session status (pause/resume)
router.post('/session/status', counterLiveController.updateSessionStatus);

// Pause/Resume counter session
router.post('/toggle-session', counterLiveController.toggleSession);

module.exports = router;
