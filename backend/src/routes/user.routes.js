const express = require('express');
const {
    getUsers,
    getUser,
    postUser,
    putUser,
    deleteUserById,
    putReactivateUser,
    postResetPassword,
} = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

// Tất cả routes yêu cầu authentication
router.use(authenticate);

// Tất cả routes yêu cầu role admin hoặc manager
router.use(authorize(['admin', 'manager']));

// GET /api/users - Get all users
router.get('/', getUsers);

// GET /api/users/:id - Get user by id
router.get('/:id', getUser);

// POST /api/users - Create new user
router.post('/', postUser);

// PUT /api/users/:id - Update user
router.put('/:id', putUser);

// PUT /api/users/:id/reactivate - Reactivate user
router.put('/:id/reactivate', putReactivateUser);

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', postResetPassword);

// DELETE /api/users/:id - Delete/Deactivate user
router.delete('/:id', deleteUserById);

module.exports = router;
