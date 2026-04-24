const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Middleware
app.use(cors({
    origin: '*', // Cho phép tất cả (Dễ nhất để test LAN)
    credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attach Socket.IO instance to each request (set in server.js)
app.use((req, _res, next) => {
    req.io = req.app.get('io');
    next();
});

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({
        message: 'SEQMS Admin Backend Server',
        version: '1.0.0',
        status: 'running',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Error handling middleware
app.use(errorMiddleware);

module.exports = app;
