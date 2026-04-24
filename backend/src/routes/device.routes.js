const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const Kiosk = require('../models/Kiosk');
const Counter = require('../models/Counter');
const EBoard = require('../models/EBoard');
const EBoardMedia = require('../models/EBoardMedia');
const TransactionOffice = require('../models/TransactionOffice');
const ServiceGroup = require('../models/ServiceGroup');
const Service = require('../models/Service');
const ebardService = require('../services/eboard.service');

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/media');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Custom error handler for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'File too large' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, message: 'Too many files' });
        }
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
};

// ==================== E-BOARD MEDIA (Public routes before auth middleware) ====================

// POST /api/devices/media/upload - Upload media file (requires auth)
router.post('/media/upload', authenticate, authorize(['admin', 'manager']), (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        handleMulterError(err, req, res, next);
    });
}, async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Use relative path for file URL (database storage)
        const fileUrl = `/uploads/media/${req.file.filename}`;
        const fileType = req.file.mimetype.startsWith('video') ? 'video' : 'image';

        res.status(201).json({
            success: true,
            data: {
                file_url: fileUrl,
                file_type: fileType,
                file_name: req.file.originalname,
            }
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/media/cleanup - Delete uploaded file if user cancels
router.delete('/media/cleanup', authenticate, authorize(['admin', 'manager']), async (req, res, next) => {
    try {
        const { file_path } = req.body;

        if (!file_path) {
            return res.status(400).json({ success: false, message: 'file_path is required' });
        }

        // Validate path to prevent directory traversal attacks
        if (file_path.includes('..')) {
            return res.status(400).json({ success: false, message: 'Invalid file path' });
        }

        // Normalize path (remove leading slash if present)
        let normalizedPath = file_path;
        if (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.substring(1);
        }

        // Construct full file path
        const filePath = path.join(__dirname, '../../', normalizedPath);

        // Ensure file is within uploads directory
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!filePath.startsWith(uploadsDir)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Delete file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'File deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'File not found' });
        }
    } catch (error) {
        next(error);
    }
});

// Tất cả routes yêu cầu authentication và role admin/manager
router.use(authenticate);
router.use(authorize(['admin', 'manager']));

// ==================== KIOSKS ====================

// GET /api/devices/kiosks
router.get('/kiosks', authenticate, async (req, res, next) => {
    try {
        const { transaction_office_id } = req.query;
        const where = transaction_office_id ? { transaction_office_id } : {};
        const kiosks = await Kiosk.findAll({
            where,
            include: [
                { model: TransactionOffice },
                { model: ServiceGroup },
            ],
        });
        res.json({ success: true, data: kiosks });
    } catch (error) {
        next(error);
    }
});

// GET /api/devices/kiosks/:id
router.get('/kiosks/:id', authenticate, async (req, res, next) => {
    try {
        const kiosk = await Kiosk.findByPk(req.params.id, {
            include: [
                { model: TransactionOffice },
                { model: ServiceGroup },
            ],
        });
        if (!kiosk) return res.status(404).json({ success: false, message: 'Kiosk not found' });
        res.json({ success: true, data: kiosk });
    } catch (error) {
        next(error);
    }
});

// POST /api/devices/kiosks
router.post('/kiosks', authenticate, async (req, res, next) => {
    try {
        const { transaction_office_id, service_group_id, code, name, ip_address, status } = req.body;
        if (!transaction_office_id || !code || !name) {
            return res.status(400).json({ success: false, message: 'transaction_office_id, code and name are required' });
        }

        const kiosk = await Kiosk.create({
            transaction_office_id,
            service_group_id,
            code,
            name,
            ip_address,
            status: status || 'active',
        });
        res.status(201).json({ success: true, data: kiosk });
    } catch (error) {
        next(error);
    }
});

// PUT /api/devices/kiosks/:id
router.put('/kiosks/:id', authenticate, async (req, res, next) => {
    try {
        const kiosk = await Kiosk.findByPk(req.params.id);
        if (!kiosk) return res.status(404).json({ success: false, message: 'Kiosk not found' });

        await kiosk.update(req.body);
        res.json({ success: true, data: kiosk });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/kiosks/:id
router.delete('/kiosks/:id', authenticate, async (req, res, next) => {
    try {
        const kiosk = await Kiosk.findByPk(req.params.id);
        if (!kiosk) return res.status(404).json({ success: false, message: 'Kiosk not found' });

        await kiosk.destroy();
        res.json({ success: true, message: 'Kiosk deleted' });
    } catch (error) {
        next(error);
    }
});

// ==================== COUNTERS ====================

// GET /api/devices/counters
router.get('/counters', authenticate, async (req, res, next) => {
    try {
        const { transaction_office_id } = req.query;
        const where = transaction_office_id ? { transaction_office_id } : {};
        const counters = await Counter.findAll({
            where,
            include: [{ model: TransactionOffice }],
        });
        res.json({ success: true, data: counters });
    } catch (error) {
        next(error);
    }
});

// GET /api/devices/counters/:id
router.get('/counters/:id', authenticate, async (req, res, next) => {
    try {
        const counter = await Counter.findByPk(req.params.id, {
            include: [
                { model: TransactionOffice },
                {
                    model: Service,
                    through: { attributes: ['priority_level'] },
                },
            ],
        });
        if (!counter) return res.status(404).json({ success: false, message: 'Counter not found' });
        res.json({ success: true, data: counter });
    } catch (error) {
        next(error);
    }
});

// POST /api/devices/counters
router.post('/counters', authenticate, async (req, res, next) => {
    try {
        const { transaction_office_id, code, name, service_ids } = req.body;
        if (!transaction_office_id || !code || !name) {
            return res.status(400).json({ success: false, message: 'transaction_office_id, code and name are required' });
        }

        const counter = await Counter.create({
            transaction_office_id,
            code,
            name,
        });

        if (service_ids && service_ids.length > 0) {
            await counter.addServices(service_ids.map(s => ({ service_id: s.id, priority_level: s.priority || 1 })));
        }

        res.status(201).json({ success: true, data: counter });
    } catch (error) {
        next(error);
    }
});

// PUT /api/devices/counters/:id
router.put('/counters/:id', authenticate, async (req, res, next) => {
    try {
        const { service_ids, ...updateData } = req.body;
        const counter = await Counter.findByPk(req.params.id);
        if (!counter) return res.status(404).json({ success: false, message: 'Counter not found' });

        await counter.update(updateData);

        if (service_ids) {
            await counter.setServices(service_ids.map(s => ({ service_id: s.id, priority_level: s.priority || 1 })));
        }

        res.json({ success: true, data: counter });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/counters/:id
router.delete('/counters/:id', authenticate, async (req, res, next) => {
    try {
        const counter = await Counter.findByPk(req.params.id);
        if (!counter) return res.status(404).json({ success: false, message: 'Counter not found' });

        await counter.destroy();
        res.json({ success: true, message: 'Counter deleted' });
    } catch (error) {
        next(error);
    }
});

// ==================== E-BOARDS ====================

// GET /api/devices/eboards
router.get('/eboards', authenticate, async (req, res, next) => {
    try {
        const { transaction_office_id } = req.query;
        const where = transaction_office_id ? { transaction_office_id } : {};
        const eboards = await EBoard.findAll({
            where,
            include: [
                { model: TransactionOffice },
                { model: EBoardMedia },
            ],
        });
        res.json({ success: true, data: eboards });
    } catch (error) {
        next(error);
    }
});

// GET /api/devices/eboards/:id
router.get('/eboards/:id', authenticate, async (req, res, next) => {
    try {
        const eboard = await EBoard.findByPk(req.params.id, {
            include: [
                { model: TransactionOffice },
                { model: EBoardMedia, order: [['sort_order', 'ASC']] },
            ],
        });
        if (!eboard) return res.status(404).json({ success: false, message: 'E-Board not found' });
        res.json({ success: true, data: eboard });
    } catch (error) {
        next(error);
    }
});

// POST /api/devices/eboards
router.post('/eboards', authenticate, async (req, res, next) => {
    try {
        const eboard = await ebardService.createEBoard(req.body);
        res.status(201).json({ success: true, data: eboard });
    } catch (error) {
        next(error);
    }
});

// PUT /api/devices/eboards/:id
router.put('/eboards/:id', authenticate, async (req, res, next) => {
    try {
        const eboard = await ebardService.updateEBoard(req.params.id, req.body);
        res.json({ success: true, data: eboard });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/eboards/:id
router.delete('/eboards/:id', authenticate, async (req, res, next) => {
    try {
        const result = await ebardService.deleteEBoard(req.params.id);
        res.json({ success: true, message: result.message });
    } catch (error) {
        next(error);
    }
});

// ==================== E-BOARD MEDIA ====================

// POST /api/devices/eboards/:id/media
router.post('/eboards/:id/media', authenticate, authorize(['admin', 'manager']), async (req, res, next) => {
    try {
        const { file_type, file_url, description, sort_order } = req.body;
        if (!file_type || !file_url) {
            return res.status(400).json({ success: false, message: 'file_type and file_url are required' });
        }

        const media = await EBoardMedia.create({
            e_board_id: req.params.id,
            file_type,
            file_url,
            description,
            sort_order: sort_order || 0,
        });
        res.status(201).json({ success: true, data: media });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/devices/media/:id
router.delete('/media/:id', authenticate, authorize(['admin', 'manager']), async (req, res, next) => {
    try {
        const media = await EBoardMedia.findByPk(req.params.id);
        if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

        // Delete file from filesystem if it's a local upload
        if (media.file_url && media.file_url.startsWith('/uploads/media/')) {
            const filePath = path.join(__dirname, '../../', media.file_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await media.destroy();
        res.json({ success: true, message: 'Media deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
