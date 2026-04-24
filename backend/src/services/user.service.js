const User = require('../models/User');
const TransactionOffice = require('../models/TransactionOffice');
const CounterSession = require('../models/CounterSession');
const { sequelize, Op } = require('../config/db');
const { emitCounterForceLogout } = require('../socket');

const USER_REACTIVATE_GUARD_MESSAGE = 'Không thể khôi phục tài khoản này vì Phòng Giao Dịch trực thuộc đang bị vô hiệu hóa.';

const getAllUsers = async () => {
    const users = await User.findAll({
        attributes: { exclude: ['password_hash'] },
        include: [
            {
                model: TransactionOffice,
                as: 'TransactionOffice',
                attributes: ['id', 'code', 'name', 'is_active'],
                required: false,
            },
        ],
        order: [['id', 'ASC']],
    });
    return users;
};

const getUserById = async (userId) => {
    const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] },
        include: [
            {
                model: TransactionOffice,
                as: 'TransactionOffice',
                attributes: ['id', 'code', 'name', 'is_active'],
                required: false,
            },
        ],
    });
    if (!user) {
        throw new Error('Không tìm thấy người dùng');
    }
    return user;
};

const createUser = async (userData) => {
    const {
        username,
        email,
        password_hash,
        full_name,
        role = 'staff',
        phone = null,
        job_title = null,
        transaction_office_id = null,
    } = userData;

    // Validation
    if (!username || !password_hash || !full_name) {
        throw new Error('Tên đăng nhập, mật khẩu và tên đầy đủ là bắt buộc');
    }

    // Check if user already exists
    const existingUser = await User.findOne({
        where: {
            [require('sequelize').Op.or]: [{ username }],
        },
    });

    if (existingUser) {
        throw new Error(`Tên đăng nhập '${username}' đã tồn tại`);
    }

    // If email is provided, check uniqueness
    if (email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
            throw new Error(`Email '${email}' đã tồn tại`);
        }
    }

    // Validate staff/manager must have transaction_office_id
    if ((role === 'staff' || role === 'manager') && !transaction_office_id) {
        throw new Error('Nhân viên và Quản lý phải được gán vào phòng giao dịch');
    }

    const user = await User.create({
        username,
        email,
        password_hash,
        full_name,
        role,
        phone,
        job_title,
        transaction_office_id,
    });

    // Return user with office details
    return await getUserById(user.id);
};

const updateUser = async (userId, updateData) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Không tìm thấy người dùng');
    }

    // Handle password separately - only update if new password is provided
    const { password_hash, ...otherData } = updateData;

    if (password_hash && password_hash.trim()) {
        // Password is being updated, hash will be done by beforeUpdate hook
        otherData.password_hash = password_hash;
    }
    // else: password_hash not provided or empty, keep the old one

    // Validate staff/manager must have transaction_office_id
    if ((otherData.role === 'staff' || otherData.role === 'manager') && !otherData.transaction_office_id) {
        throw new Error('Nhân viên và Quản lý phải được gán vào phòng giao dịch');
    }

    // Check email uniqueness if email is being changed
    if (otherData.email && otherData.email !== user.email) {
        const existingEmail = await User.findOne({
            where: { email: otherData.email },
        });
        if (existingEmail) {
            throw new Error(`Email '${otherData.email}' đã tồn tại`);
        }
    }

    const isReactivating = user.is_active === false && otherData.is_active === true;
    if (isReactivating) {
        const officeId = otherData.transaction_office_id !== undefined
            ? otherData.transaction_office_id
            : user.transaction_office_id;

        if (officeId) {
            const office = await TransactionOffice.findByPk(officeId, {
                attributes: ['id', 'is_active'],
            });

            if (!office || office.is_active === false) {
                const error = new Error(USER_REACTIVATE_GUARD_MESSAGE);
                error.statusCode = 400;
                throw error;
            }
        }
    }

    await user.update(otherData);

    return await getUserById(userId);
};

const deleteUser = async (userId) => {
    const transaction = await sequelize.transaction();

    try {
        const user = await User.findByPk(userId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!user) {
            throw new Error('Không tìm thấy người dùng');
        }

        const activeSessions = await CounterSession.findAll({
            where: {
                user_id: user.id,
                status: {
                    [Op.in]: ['active', 'paused'],
                },
            },
            attributes: ['id', 'counter_id'],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        await user.update(
            { is_active: false },
            { transaction }
        );

        if (activeSessions.length > 0) {
            await CounterSession.update(
                {
                    status: 'ended',
                    logout_time: new Date(),
                },
                {
                    where: {
                        id: activeSessions.map((session) => session.id),
                    },
                    transaction,
                }
            );
        }

        await transaction.commit();

        const uniqueCounterIds = Array.from(new Set(activeSessions.map((session) => session.counter_id).filter(Boolean)));
        uniqueCounterIds.forEach((counterId) => {
            emitCounterForceLogout(counterId, {
                counter_id: counterId,
                message: 'Tài khoản nhân viên đã bị vô hiệu hóa. Phiên làm việc đã kết thúc.',
                reason: 'USER_DEACTIVATED',
                force_logout: true,
            });
        });

        return {
            id: user.id,
            message: 'Tài khoản người dùng đã được vô hiệu hóa',
            closed_sessions: activeSessions.length,
        };
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
};

const reactivateUser = async (userId) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Không tìm thấy người dùng');
    }

    if (user.transaction_office_id) {
        const office = await TransactionOffice.findByPk(user.transaction_office_id, {
            attributes: ['id', 'is_active'],
        });

        if (!office || office.is_active === false) {
            const error = new Error(USER_REACTIVATE_GUARD_MESSAGE);
            error.statusCode = 400;
            throw error;
        }
    }

    await user.update({ is_active: true });

    return {
        id: user.id,
        message: 'Tài khoản người dùng đã được khôi phục',
    };
};

const resetUserPassword = async (userId, newPassword) => {
    const user = await User.findByPk(userId);

    if (!user) {
        throw new Error('Không tìm thấy người dùng');
    }

    if (!newPassword || !newPassword.trim()) {
        throw new Error('Mật khẩu mới là bắt buộc');
    }

    await user.update({ password_hash: newPassword });

    return {
        id: user.id,
        message: 'Đặt lại mật khẩu thành công',
    };
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    reactivateUser,
    resetUserPassword,
};
