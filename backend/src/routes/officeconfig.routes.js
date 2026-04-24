const express = require('express');
const {
    getConfigs,
    getConfigDetails,
    saveConfig,
    deleteConfig,
} = require('../controllers/officeconfig.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

/**
 * Office Configuration Routes
 * Base path: /api/office-configs
 */

// GET all office configurations with summary
router.get('/', authenticate, getConfigs);

// GET specific office configuration details
router.get('/:officeId/details', authenticate, getConfigDetails);

// POST save office configuration
router.post('/:officeId', authenticate, saveConfig);

// DELETE office configuration
router.delete('/:officeId', authenticate, deleteConfig);

module.exports = router;
