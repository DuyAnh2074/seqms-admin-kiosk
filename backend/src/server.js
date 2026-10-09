require('dotenv').config();
const app = require('./app');
const { connectPostgres, pingDatabase } = require('./config/db');
const { createServer } = require('http');
const { initializeSocketIO } = require('./socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Connect to PostgreSQL
        await connectPostgres();

        const keepAliveInterval = setInterval(pingDatabase, 4 * 60 * 1000);
        keepAliveInterval.unref();

        // Create HTTP server
        const httpServer = createServer(app);

        // Initialize Socket.IO
        const io = initializeSocketIO(httpServer);

        // Make io available to the app
        app.set('io', io);

        // Start server (listen on 0.0.0.0 to accept external connections)
        httpServer.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
            console.log(`🔌 Socket.IO is ready for real-time connections`);
            console.log(`📝 API Documentation:`);
            console.log(`   - Health Check: GET http://localhost:${PORT}/api/health`);
            console.log(`   - Login: POST http://localhost:${PORT}/api/auth/login`);
            console.log(`   - Get Users: GET http://localhost:${PORT}/api/users`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
