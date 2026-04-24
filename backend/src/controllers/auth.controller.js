const { sendSuccess, sendError } = require('../utils/response');
const { loginUser } = require('../services/auth.service');

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return sendError(res, 'Username and password are required', 400);
        }

        const result = await loginUser(username, password);
        sendSuccess(res, result, 'Login successful', 200);
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.message, error.statusCode);
        }

        if (error.message === 'Tên đăng nhập hoặc mật khẩu không đúng') {
            return sendError(res, error.message, 401);
        }
        next(error);
    }
};

module.exports = {
    login,
};
