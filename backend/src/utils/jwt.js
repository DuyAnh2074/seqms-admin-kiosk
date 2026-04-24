const jwt = require('jsonwebtoken');

const generateToken = (userId, username, role) => {
    const payload = {
        id: userId,
        username: username,
        role: role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '24h',
    });

    return token;
};

const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken,
};
