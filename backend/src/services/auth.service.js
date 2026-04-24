const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

const loginUser = async (username, password) => {
    // Find user by username
    const user = await User.findOne({ where: { username } });

    if (!user) {
        throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    if (user.is_active === false) {
        const error = new Error('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.');
        error.statusCode = 403;
        throw error;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    // Generate token
    const token = generateToken(user.id, user.username, user.role);

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
        },
    };
};

module.exports = {
    loginUser,
};
