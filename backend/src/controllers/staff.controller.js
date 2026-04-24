const staffService = require('../services/staff.service');

/**
 * Get current user's office info
 * Lấy thông tin phòng giao dịch của nhân viên hiện tại
 */
const getUserOffice = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const data = await staffService.getUserOffice(userId);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get available counters for the current user (staff)
 * Lấy danh sách quầy khả dụng cho nhân viên đó
 * Query param: office_id (optional) - allows selecting counters from a specific office
 */
const getAvailableCounters = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { office_id } = req.query;
        const countersWithStatus = await staffService.getAvailableCounters(userId, office_id);
        res.json({
            success: true,
            data: countersWithStatus,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Start a counter session for the current user (staff)
 * Khởi tạo phiên làm việc cho nhân viên
 */
const startSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { counter_id } = req.body;
        const result = await staffService.startSession(userId, counter_id);
        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * End current session for the user
 * Kết thúc phiên làm việc
 */
const endSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const session = await staffService.endSession(userId);
        res.json({
            success: true,
            message: 'Session ended successfully',
            data: session,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * End session by session_token (No JWT required)
 */
const endSessionByToken = async (req, res, next) => {
    try {
        const sessionToken = req.headers['x-counter-session-token'] || req.body.sessionToken || req.query.session_token;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                message: 'Session token is required',
            });
        }

        const session = await staffService.endSessionByToken(sessionToken);

        res.json({
            success: true,
            message: session ? 'Session ended successfully' : 'No active session to end',
            data: session,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current session for the user
 * Lấy thông tin phiên làm việc hiện tại
 * Returns success with null if user hasn't selected a counter yet (no active session)
 */
const getCurrentSession = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const session = await staffService.getCurrentSession(userId);

        // No active session is a normal state on first login/re-login.
        res.json({
            success: true,
            data: session || null,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Restore session from session_token
 * Khôi phục phiên làm việc từ session_token (dùng cho auto-restore sau refresh)
 */
const restoreSession = async (req, res, next) => {
    try {
        // Get session_token from header or query param
        const sessionToken = req.headers['x-counter-session-token'] || req.query.session_token;
        const userId = req.user.id;
        const data = await staffService.restoreSession(sessionToken, userId);
        res.json({
            success: true,
            data,
        });
    } catch (error) {
        const message = (error.message || '').toLowerCase();
        if (error.isExpectedSessionError || message.includes('session not found') || message.includes('counter is inactive')) {
            return res.status(error.statusCode || 401).json({
                success: false,
                message: error.message,
            });
        }
        next(error);
    }
};

/**
 * POST /api/staff/assign-counter
 * Assign a counter to the current staff member with race condition handling
 * 
 * Kịch bản xử lý:
 * - Sử dụng SERIALIZABLE transaction để lock dữ liệu
 * - Kiểm tra counter có active session hay không
 * - Nếu có, reject request
 * - Nếu không, tạo session mới
 * - Gửi WebSocket event để notify clients về thay đổi trạng thái
 */
const assignCounter = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { counter_id } = req.body;

        const result = await staffService.assignCounter(userId, counter_id);

        // ============================================================
        // Gửi WebSocket event để notify tất cả clients
        // ============================================================
        if (req.io) {
            // Broadcast event: counter-assigned
            // Clients sẽ listen và cập nhật UI
            req.io.emit('counter-assigned', {
                event_type: 'COUNTER_OCCUPIED',
                counter_id: counter_id,
                user_id: userId,
                timestamp: new Date(),
            });

            console.log(
                `📡 WebSocket: Sent counter-assigned event for counter ${counter_id}`
            );
        }

        res.status(201).json({
            success: true,
            message: 'Counter assigned successfully',
            data: result,
        });
    } catch (error) {
        // Xử lý race condition error
        if (error.statusCode === 409) {
            // Conflict - counter already occupied
            return res.status(409).json({
                success: false,
                message: error.message,
                data: error.conflictData,
            });
        }

        next(error);
    }
};

module.exports = {
    getUserOffice,
    getAvailableCounters,
    startSession,
    endSession,
    endSessionByToken,
    getCurrentSession,
    restoreSession,
    assignCounter,
};
