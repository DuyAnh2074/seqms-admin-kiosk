const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const User = require('../models/User');

/**
 * Combined Authentication & Authorization Middleware
 * Handles both token verification and role-based access control
 */

/**
 * Middleware to verify JWT token and attach user info to request
 * Must be used before authorize middleware
 * 
 * @example
 * router.use(authenticate);
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = verifyToken(token);

        if (!decoded) {
            return sendError(res, 'Invalid or expired token', 401);
        }

        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'is_active', 'role', 'username'],
        });

        if (!user) {
            return sendError(res, 'Invalid token', 401);
        }

        if (user.is_active === false) {
            return sendError(res, 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.', 403);
        }

        // Attach user to request
        req.user = decoded;
        next();
    } catch (error) {
        sendError(res, 'Authentication failed', 401, error.message);
    }
};

/**
 * Middleware to check user role and grant/deny access
 * Must be used after authenticate middleware
 * 
 * @param {Array<string>} allowedRoles - Danh sách roles được phép truy cập
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/admin-only', authorize(['admin']), controller.action);
 * router.get('/admin-manager', authorize(['admin', 'manager']), controller.action);
 */
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    error: 'Unauthorized',
                });
            }

            const userRole = req.user.role;

            // If user has no role
            if (!userRole) {
                return res.status(403).json({
                    success: false,
                    message: 'User role not found',
                    error: 'Forbidden',
                });
            }

            // Check if user role is in allowed roles
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
                    error: 'Forbidden',
                    userRole: userRole,
                });
            }

            // User has permission, proceed
            next();
        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(500).json({
                success: false,
                message: 'Authorization check failed',
                error: error.message,
            });
        }
    };
};

/**
 * Shorthand for admin-only access
 * Same as authorize(['admin'])
 */
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return sendError(res, 'Unauthorized', 401);
    }

    if (req.user.role !== 'admin') {
        return sendError(res, 'Only admins can access this', 403);
    }

    next();
};

module.exports = {
    authenticate,
    authorize,
    adminOnly,
};
