const { sendSuccess, sendError } = require('../utils/response');
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    reactivateUser,
    resetUserPassword,
} = require('../services/user.service');

const getUsers = async (req, res, next) => {
    try {
        const users = await getAllUsers();
        sendSuccess(res, users, 'Users retrieved successfully');
    } catch (error) {
        next(error);
    }
};

const getUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await getUserById(id);
        sendSuccess(res, user, 'User retrieved successfully');
    } catch (error) {
        if (error.message === 'User not found') {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

const postUser = async (req, res, next) => {
    try {
        const {
            username,
            email,
            password_hash,
            full_name,
            role,
            phone,
            job_title,
            transaction_office_id,
        } = req.body;

        // Validation
        if (!username || !password_hash || !full_name) {
            return sendError(
                res,
                'username, password_hash, and full_name are required',
                400
            );
        }

        const userData = {
            username,
            email,
            password_hash,
            full_name,
            role: role || 'staff',
            phone,
            job_title,
            transaction_office_id,
        };

        const user = await createUser(userData);
        sendSuccess(res, user, 'User created successfully', 201);
    } catch (error) {
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 400);
        }
        if (error.message.includes('must be assigned')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

const putUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            username,
            email,
            full_name,
            role,
            phone,
            job_title,
            transaction_office_id,
            password_hash,
            is_active,
        } = req.body;

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (email !== undefined) updateData.email = email;
        if (full_name !== undefined) updateData.full_name = full_name;
        if (role !== undefined) updateData.role = role;
        if (phone !== undefined) updateData.phone = phone;
        if (job_title !== undefined) updateData.job_title = job_title;
        if (transaction_office_id !== undefined) updateData.transaction_office_id = transaction_office_id;
        if (password_hash !== undefined) updateData.password_hash = password_hash;
        if (is_active !== undefined) updateData.is_active = is_active;

        const user = await updateUser(id, updateData);
        sendSuccess(res, user, 'User updated successfully');
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.message, error.statusCode);
        }
        if (error.message === 'User not found') {
            return sendError(res, error.message, 404);
        }
        if (error.message.includes('already exists')) {
            return sendError(res, error.message, 400);
        }
        if (error.message.includes('must be assigned')) {
            return sendError(res, error.message, 400);
        }
        next(error);
    }
};

const deleteUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await deleteUser(id);
        sendSuccess(res, result, 'User deactivated successfully');
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.message, error.statusCode);
        }
        if (error.message === 'User not found') {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

const putReactivateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await reactivateUser(id);
        sendSuccess(res, result, 'User reactivated successfully');
    } catch (error) {
        if (error.statusCode) {
            return sendError(res, error.message, error.statusCode);
        }
        if (error.message === 'User not found') {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

const postResetPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { new_password } = req.body;

        if (!new_password) {
            return sendError(res, 'new_password is required', 400);
        }

        const result = await resetUserPassword(id, new_password);
        sendSuccess(res, result, 'Password reset successfully');
    } catch (error) {
        if (error.message === 'User not found') {
            return sendError(res, error.message, 404);
        }
        next(error);
    }
};

module.exports = {
    getUsers,
    getUser,
    postUser,
    putUser,
    deleteUserById,
    putReactivateUser,
    postResetPassword,
};
