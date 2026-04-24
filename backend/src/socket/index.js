const { Server } = require('socket.io');
const CounterSession = require('../models/CounterSession');

let io = null;

/**
 * Initialize Socket.IO server
 */
function initializeSocketIO(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Handle counter session join
        socket.on('join-counter-session', async (data) => {
            try {
                const { sessionToken } = data;

                if (!sessionToken) {
                    socket.emit('error', { message: 'Session token is required' });
                    return;
                }

                // Verify session token
                const session = await CounterSession.findOne({
                    where: {
                        session_token: sessionToken,
                        status: 'active',
                    },
                    attributes: ['id', 'counter_id', 'transaction_office_id'],
                });

                if (!session) {
                    socket.emit('error', { message: 'Invalid or inactive session' });
                    return;
                }

                // Join room for this counter session
                const roomName = `counter-${session.counter_id}`;
                const officeRoomName = `office-${session.transaction_office_id}`;

                socket.join(roomName);
                socket.join(officeRoomName);

                // Store session info in socket
                socket.data.counterId = session.counter_id;
                socket.data.officeId = session.transaction_office_id;
                socket.data.sessionToken = sessionToken;

                console.log(`✅ Socket ${socket.id} joined room: ${roomName} and ${officeRoomName}`);

                socket.emit('joined-successfully', {
                    counterId: session.counter_id,
                    officeId: session.transaction_office_id,
                });
            } catch (error) {
                console.error('Error joining counter session:', error);
                socket.emit('error', { message: 'Failed to join counter session' });
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });

        // Handle TV display room join (for E-Board)
        socket.on('join_office', (data) => {
            try {
                const { transaction_office_id } = data;

                if (!transaction_office_id) {
                    socket.emit('error', { message: 'Office ID is required' });
                    return;
                }

                const officeRoomName = `office-${transaction_office_id}`;
                socket.join(officeRoomName);
                socket.data.officeId = transaction_office_id;

                console.log(`✅ TV Display ${socket.id} joined room: ${officeRoomName}`);

                socket.emit('joined-successfully', {
                    officeId: transaction_office_id,
                    message: 'Joined office room for ticket updates',
                });
            } catch (error) {
                console.error('Error joining office room:', error);
                socket.emit('error', { message: 'Failed to join office room' });
            }
        });
    });

    console.log('✅ Socket.IO initialized');
    return io;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
    }
    return io;
}

/**
 * Emit queue update to specific counter
 */
function emitQueueUpdate(counterId, queueData) {
    if (!io) return;

    const roomName = `counter-${counterId}`;
    io.to(roomName).emit('queue-updated', queueData);
    console.log(`📤 Emitted queue-updated to ${roomName}`);
}

/**
 * Emit queue update to all counters in an office
 */
function emitOfficeQueueUpdate(officeId, queueData) {
    if (!io) return;

    const roomName = `office-${officeId}`;
    io.to(roomName).emit('queue-updated', queueData);
    console.log(`📤 Emitted queue-updated to ${roomName}`);
}

/**
 * Emit ticket called event (for TV display)
 */
function emitTicketCalled(officeId, ticketData) {
    if (!io) return;

    const roomName = `office-${officeId}`;
    io.to(roomName).emit('ticket-called', ticketData);
    console.log(`📢 Emitted ticket-called to ${roomName}`);
}

/**
 * Emit kiosk state change (deactivate/reactivate)
 */
function emitKioskStateChanged(kioskData) {
    if (!io) return;

    io.emit('kiosk-state-changed', kioskData);
    console.log(`📢 Emitted kiosk-state-changed for kiosk ${kioskData?.id}`);
}

/**
 * Emit force logout event for a specific counter room
 */
function emitCounterForceLogout(counterId, payload) {
    if (!io) return;

    const roomName = `counter-${counterId}`;
    io.to(roomName).emit('counter-force-logout', payload);
    console.log(`📢 Emitted counter-force-logout to ${roomName}`);
}

/**
 * Emit counter configuration updates so active staff sessions can refetch permissions.
 */
function emitCounterConfigUpdated(counterId, payload = {}) {
    if (!io) return;

    const roomName = `counter-${counterId}`;
    io.to(roomName).emit('CONFIG_UPDATED', {
        counter_id: counterId,
        ...payload,
    });
    console.log(`📢 Emitted CONFIG_UPDATED to ${roomName}`);
}

/**
 * Emit e-board state change (maintenance/deactivate/reactivate)
 */
function emitEBoardStateChanged(eboardData) {
    if (!io) return;

    io.emit('eboard-state-changed', eboardData);

    if (eboardData?.transaction_office_id) {
        io.to(`office-${eboardData.transaction_office_id}`).emit('eboard-state-changed', eboardData);
    }

    console.log(`📢 Emitted eboard-state-changed for board ${eboardData?.id}`);
}

module.exports = {
    initializeSocketIO,
    getIO,
    emitQueueUpdate,
    emitOfficeQueueUpdate,
    emitTicketCalled,
    emitKioskStateChanged,
    emitCounterForceLogout,
    emitCounterConfigUpdated,
    emitEBoardStateChanged,
};
