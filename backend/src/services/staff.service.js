const { Sequelize, sequelize, Op } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Counter = require('../models/Counter');
const CounterSession = require('../models/CounterSession');
const TransactionOffice = require('../models/TransactionOffice');
const Transaction = require('../models/Transaction');

const createOfficeInactiveError = (message = 'Phòng giao dịch đang tạm ngưng hoạt động') => {
    const error = new Error(message);
    error.statusCode = 403;
    return error;
};

class StaffService {
    /**
     * Get current user's office info
     * Lấy thông tin phòng giao dịch của nhân viên hiện tại
     */
    async getUserOffice(userId) {
        try {
            // Get user info with transaction office
            const user = await User.findByPk(userId, {
                include: [
                    {
                        model: TransactionOffice,
                        as: 'TransactionOffice',
                        attributes: ['id', 'code', 'name'],
                    },
                ],
            });

            if (!user) {
                throw new Error('User not found');
            }

            if (!user.TransactionOffice) {
                throw new Error('User does not have an assigned office');
            }

            return {
                office_id: user.TransactionOffice.id,
                office_code: user.TransactionOffice.code,
                office_name: user.TransactionOffice.name,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get available counters for the current user (staff)
     * Lấy danh sách quầy khả dụng cho nhân viên đó
     */
    async getAvailableCounters(userId, officeId = null) {
        try {
            // Get user's transaction_office_id (PGD)
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Use the provided office_id or fallback to user's assigned office
            const transactionOfficeId = officeId ? parseInt(officeId) : user.transaction_office_id;

            const office = await TransactionOffice.findByPk(transactionOfficeId, {
                attributes: ['id', 'is_active'],
            });

            if (!office || office.is_active === false) {
                throw createOfficeInactiveError('Phòng giao dịch đang tạm ngưng hoạt động');
            }

            // Get all counters in the specified office
            const counters = await Counter.findAll({
                where: {
                    transaction_office_id: transactionOfficeId,
                    is_active: true,
                },
                attributes: ['id', 'code', 'name', 'led_number'],
            });

            // Check which counters have active sessions from OTHER users
            // (Exclude current user's sessions so their old quầy doesn't show as occupied)
            const activeSessions = await CounterSession.findAll({
                where: {
                    user_id: {
                        [Op.ne]: userId, // NOT equal to current user
                    },
                    status: 'active', // ONLY active, not paused or ended
                },
                attributes: ['counter_id', 'user_id'],
            });

            const activeCounterIds = new Set(activeSessions.map(s => s.counter_id));

            // Add is_occupied flag to each counter
            const countersWithStatus = counters.map(counter => ({
                counter_id: counter.id,
                counter_number: counter.code,
                counter_name: counter.name,
                is_occupied: activeCounterIds.has(counter.id),
            }));

            return countersWithStatus;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Start a counter session for the current user (staff)
     * Khởi tạo phiên làm việc cho nhân viên
     */
    async startSession(userId, counterId) {
        const transaction = await sequelize.transaction();

        try {
            // Validate input
            if (!counterId) {
                throw new Error('counter_id is required');
            }

            // Get user info
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                await transaction.rollback();
                throw new Error('User not found');
            }

            // Get counter info
            const counter = await Counter.findByPk(counterId, { transaction });
            if (!counter) {
                await transaction.rollback();
                throw new Error('Counter not found');
            }

            if (!counter.is_active) {
                await transaction.rollback();
                throw new Error('Counter is inactive');
            }

            const office = await TransactionOffice.findByPk(counter.transaction_office_id, {
                transaction,
                attributes: ['id', 'is_active'],
            });

            if (!office || office.is_active === false) {
                await transaction.rollback();
                throw createOfficeInactiveError('Không thể mở phiên. Phòng giao dịch đã bị vô hiệu hóa.');
            }

            // Cleanup: Close any previous sessions for this user
            const previousSessions = await CounterSession.findAll({
                where: {
                    user_id: userId,
                    status: ['active', 'paused'],
                },
                transaction,
            });

            console.log(`📊 startSession - user ${userId} previous sessions:`, previousSessions.length);

            if (previousSessions.length > 0) {
                await CounterSession.update(
                    {
                        status: 'ended',
                        logout_time: new Date(),
                    },
                    {
                        where: {
                            user_id: userId,
                            status: ['active', 'paused'],
                        },
                        transaction,
                    }
                );
            }

            // Generate unique session token
            const sessionToken = uuidv4();

            // Create new session
            const newSession = await CounterSession.create(
                {
                    transaction_office_id: counter.transaction_office_id,
                    user_id: userId,
                    counter_id: counterId,
                    session_token: sessionToken,
                    login_time: new Date(),
                    status: 'active',
                    total_served: 0,
                },
                { transaction }
            );

            console.log(`✅ startSession - user ${userId} started session at counter ${counterId}`);

            // Commit transaction
            await transaction.commit();

            // Return session info
            return {
                session: {
                    id: newSession.id,
                    transaction_office_id: newSession.transaction_office_id,
                    user_id: newSession.user_id,
                    counter_id: newSession.counter_id,
                    session_token: newSession.session_token,
                    login_time: newSession.login_time,
                    status: newSession.status,
                    total_served: newSession.total_served,
                },
                counter: {
                    counter_id: counter.id,
                    counter_number: counter.code,
                    counter_name: counter.name,
                },
                user: {
                    user_id: user.id,
                    username: user.username,
                    transaction_office_id: user.transaction_office_id,
                },
            };
        } catch (error) {
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }

    /**
     * End current session for the user
     * Kết thúc phiên làm việc
     */
    async endSession(userId) {
        try {
            // Find active session
            const session = await CounterSession.findOne({
                where: {
                    user_id: userId,
                    status: 'active',
                },
            });

            if (!session) {
                throw new Error('No active session found');
            }

            // Calculate average waiting time for tickets served in this session
            // waiting_time = started_at - printed_at (in seconds)
            // Calculate average waiting time for tickets served in this session
            // Recalculate based on unique tickets to avoid over-weighting add-on services
            const statsResult = await Transaction.findAll({
                where: {
                    user_id: userId,
                    status: 'completed',
                    waiting_time_seconds: { [Op.not]: null },
                    finished_at: { [Op.gte]: session.login_time }
                },
                attributes: [
                    'ticket_number',
                    [sequelize.fn('MAX', sequelize.col('waiting_time_seconds')), 'wait_time']
                ],
                group: ['ticket_number'],
                raw: true
            });

            const totalWaitTime = statsResult.reduce((sum, row) => sum + parseInt(row.wait_time || 0), 0);
            const avgWaitingTime = statsResult.length > 0 ? Math.round(totalWaitTime / statsResult.length) : 0;

            // Update session to ended with avg_waiting_time
            await session.update({
                status: 'ended',
                logout_time: new Date(),
                avg_waiting_time: avgWaitingTime,
                total_served: statsResult.length
            });

            return session;
        } catch (error) {
            throw error;
        }
    }

    /**
     * End session by session_token (used when JWT expired)
     */
    async endSessionByToken(sessionToken) {
        try {
            const session = await CounterSession.findOne({
                where: {
                    session_token: sessionToken,
                    status: 'active',
                },
            });

            if (!session) {
                return null;
            }

            const userId = session.user_id;

            // Calculate average waiting time for tickets served in this session
            // Recalculate based on unique tickets to avoid over-weighting add-on services
            const statsResult = await Transaction.findAll({
                where: {
                    user_id: userId,
                    status: 'completed',
                    waiting_time_seconds: { [Op.not]: null },
                    finished_at: { [Op.gte]: session.login_time }
                },
                attributes: [
                    'ticket_number',
                    [sequelize.fn('MAX', sequelize.col('waiting_time_seconds')), 'wait_time']
                ],
                group: ['ticket_number'],
                raw: true
            });

            const totalWaitTime = statsResult.reduce((sum, row) => sum + parseInt(row.wait_time || 0), 0);
            const avgWaitingTime = statsResult.length > 0 ? Math.round(totalWaitTime / statsResult.length) : 0;

            await session.update({
                status: 'ended',
                logout_time: new Date(),
                avg_waiting_time: avgWaitingTime,
                total_served: statsResult.length
            });

            return session;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get current session for the user
     * Lấy thông tin phiên làm việc hiện tại
     * Returns null if no active session exists (user hasn't selected a counter yet)
     */
    async getCurrentSession(userId) {
        try {
            // Find active session with counter info
            const session = await CounterSession.findOne({
                where: {
                    user_id: userId,
                    status: 'active',
                },
                include: [
                    {
                        model: Counter,
                        as: 'Counter',
                        attributes: ['id', 'code', 'name'],
                    },
                ],
            });

            // Return null if no session (user hasn't selected a counter yet)
            // This is a normal state, not an error
            if (!session) {
                return null;
            }

            return session;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Restore session from session_token
     * Khôi phục phiên làm việc từ session_token (dùng cho auto-restore sau refresh)
     */
    async restoreSession(sessionToken, userId) {
        try {
            if (!sessionToken) {
                throw new Error('session_token is required');
            }

            // Find active session with this token
            const session = await CounterSession.findOne({
                where: {
                    session_token: sessionToken,
                    status: 'active',
                },
                include: [
                    {
                        model: Counter,
                        as: 'Counter',
                        attributes: ['id', 'code', 'name', 'led_number', 'is_active'],
                    },
                    {
                        model: User,
                        as: 'User',
                        attributes: ['id', 'username', 'email', 'role'],
                    },
                    {
                        model: TransactionOffice,
                        as: 'TransactionOffice',
                        attributes: ['id', 'code', 'name', 'is_active'],
                    },
                ],
            });

            if (!session) {
                const error = new Error('Session not found or expired');
                error.statusCode = 401;
                error.isExpectedSessionError = true;
                throw error;
            }

            // Verify the session belongs to the authenticated user
            if (session.user_id !== userId) {
                throw new Error('Session does not belong to current user');
            }

            if (!session.Counter || !session.Counter.is_active) {
                const error = new Error('Counter is inactive');
                error.statusCode = 401;
                error.isExpectedSessionError = true;
                throw error;
            }

            if (!session.TransactionOffice || session.TransactionOffice.is_active === false) {
                const error = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
                error.statusCode = 403;
                error.isExpectedSessionError = true;
                throw error;
            }

            return {
                session: {
                    id: session.id,
                    transaction_office_id: session.transaction_office_id,
                    user_id: session.user_id,
                    counter_id: session.counter_id,
                    session_token: session.session_token,
                    login_time: session.login_time,
                    status: session.status,
                    total_served: session.total_served,
                },
                counter: {
                    counter_id: session.Counter.id,
                    counter_number: session.Counter.code,
                    counter_name: session.Counter.name,
                    led_number: session.Counter.led_number,
                },
                office: {
                    office_id: session.TransactionOffice.id,
                    office_code: session.TransactionOffice.code,
                    office_name: session.TransactionOffice.name,
                },
                user: {
                    user_id: session.User.id,
                    username: session.User.username,
                    role: session.User.role,
                },
            };
        } catch (error) {
            throw error;
        }
    }


    async assignCounter(userId, counterId) {
        const transaction = await sequelize.transaction({
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE,
        });

        try {
            // Validate input
            if (!counterId || typeof counterId !== 'number') {
                throw new Error('Invalid counter_id format');
            }

            // ============================================================
            // BƯỚC 1: Lấy thông tin user & counter
            // ============================================================
            const user = await User.findByPk(userId, { transaction });
            if (!user) {
                throw new Error('User not found');
            }

            const counter = await Counter.findByPk(counterId, { transaction });
            if (!counter) {
                throw new Error('Counter not found');
            }

            if (!counter.is_active) {
                throw new Error('Counter is inactive');
            }

            const office = await TransactionOffice.findByPk(counter.transaction_office_id, {
                transaction,
                attributes: ['id', 'is_active'],
            });

            if (!office || office.is_active === false) {
                throw createOfficeInactiveError('Không thể mở phiên. Phòng giao dịch đã bị vô hiệu hóa.');
            }

            // ============================================================
            // BƯỚC 2: Lock row này để prevent race condition
            // SELECT * FROM counter_sessions WHERE counter_id = ? FOR UPDATE
            // Nếu có transaction khác đang lock, cái này sẽ chờ
            // ============================================================
            const existingSession = await CounterSession.findOne({
                where: {
                    counter_id: counterId,
                    status: 'active',
                },
                transaction,
                lock: transaction.LOCK.UPDATE, // Row-level lock
                raw: true,
            });

            // ============================================================
            // BƯỚC 3: Kiểm tra - nếu đã có người khác đang trực, reject
            // ============================================================
            if (existingSession && existingSession.user_id !== userId) {
                const occupiedByUser = await User.findByPk(existingSession.user_id, {
                    transaction,
                    attributes: ['id', 'username'],
                });

                const error = new Error(
                    'Quầy này đã có nhân viên khác bắt đầu phiên làm việc'
                );
                error.statusCode = 409; // Conflict
                error.conflictData = {
                    counter_id: counterId,
                    occupied_by: {
                        user_id: occupiedByUser?.id,
                        username: occupiedByUser?.username,
                    },
                    occupied_since: existingSession.login_time,
                };
                throw error;
            }

            // ============================================================
            // BƯỚC 4: Đóng session cũ của user này (nếu có ở quầy khác)
            // ============================================================
            const oldSessions = await CounterSession.findAll({
                where: {
                    user_id: userId,
                    status: {
                        [Op.in]: ['active', 'paused'],
                    },
                    counter_id: {
                        [Op.ne]: counterId, // Khác quầy hiện tại
                    },
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (oldSessions.length > 0) {
                await CounterSession.update(
                    {
                        status: 'ended',
                        logout_time: new Date(),
                    },
                    {
                        where: {
                            id: {
                                [Op.in]: oldSessions.map(s => s.id),
                            },
                        },
                        transaction,
                    }
                );
                console.log(
                    `🔄 assignCounter - User ${userId} closed ${oldSessions.length} old session(s)`
                );
            }

            // ============================================================
            // BƯỚC 5: Tạo session mới
            // ============================================================
            const sessionToken = uuidv4();
            const newSession = await CounterSession.create(
                {
                    transaction_office_id: counter.transaction_office_id,
                    user_id: userId,
                    counter_id: counterId,
                    session_token: sessionToken,
                    login_time: new Date(),
                    status: 'active',
                    total_served: 0,
                },
                { transaction }
            );

            // ============================================================
            // BƯỚC 6: Commit transaction - tất cả hay không gì
            // ============================================================
            await transaction.commit();

            console.log(
                `✅ assignCounter - User ${userId} assigned to counter ${counterId}`
            );

            return {
                session: {
                    id: newSession.id,
                    session_token: newSession.session_token,
                    counter_id: newSession.counter_id,
                    user_id: newSession.user_id,
                    login_time: newSession.login_time,
                    status: newSession.status,
                    transaction_office_id: newSession.transaction_office_id,
                },
                counter: {
                    id: counter.id,
                    code: counter.code,
                    name: counter.name,
                    led_number: counter.led_number,
                },
                user: {
                    id: user.id,
                    username: user.username,
                    office_id: user.transaction_office_id,
                },
            };
        } catch (error) {
            if (transaction && !transaction.finished) {
                await transaction.rollback();
            }
            throw error;
        }
    }
}

module.exports = new StaffService();
