const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const serviceRoutes = require('./service.routes');
const serviceGroupRoutes = require('./servicegroup.routes');
const deviceRoutes = require('./device.routes');
const ticketFormatRoutes = require('./ticketformat.routes');
const provinceRoutes = require('./province.routes');
const districtRoutes = require('./district.routes');
const transactionOfficeRoutes = require('./transactionoffice.routes');
const officeConfigRoutes = require('./officeconfig.routes');
const kioskRoutes = require('./kiosk.routes');
const counterRoutes = require('./counter.routes');
const staffRoutes = require('./staff.routes');
const counterLiveRoutes = require('./counter-live.routes');
const monitorRoutes = require('./monitor.routes');
const publicRoutes = require('./public.routes');
const reportsRoutes = require('./reports.routes');
const dashboardRoutes = require('./dashboard.routes');
const eboardRoutes = require('./eboard.routes');
const htmlFormsRoutes = require('./html-forms');
const pdfRoutes = require('./pdf');
const printRoutes = require('./print');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/services', serviceRoutes);
router.use('/service-groups', serviceGroupRoutes);
router.use('/devices', deviceRoutes);
router.use('/ticket-formats', ticketFormatRoutes);
router.use('/provinces', provinceRoutes);
router.use('/districts', districtRoutes);
router.use('/transaction-offices', transactionOfficeRoutes);
router.use('/office-configs', officeConfigRoutes);
router.use('/kiosks', kioskRoutes);
router.use('/counters', counterRoutes);
router.use('/staff', staffRoutes);
router.use('/counter-live', counterLiveRoutes);
router.use('/monitor', monitorRoutes);
router.use('/reports', reportsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/eboards', eboardRoutes);

// Public routes (no authentication)
router.use('/public', publicRoutes);
router.use('/public/html-forms', htmlFormsRoutes);
router.use('/pdf', pdfRoutes);
router.use('/print', printRoutes);

module.exports = router;
