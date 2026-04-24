const { DataTypes } = require('sequelize');
const bcryptjs = require('bcryptjs');
const { sequelize } = require('../config/db');

const User = sequelize.define(
    'User',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        transaction_office_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Null = Super Admin',
        },
        username: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        password_hash: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'password_hash',
        },
        full_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'staff',
            comment: 'admin, manager, staff',
        },
        job_title: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'Job title/position (e.g., Giao dịch viên, Quản lý)',
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true,
            validate: {
                isEmail: true,
            },
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'users',
    }
);

// Hash password before creating
User.beforeCreate(async (user) => {
    if (user.password_hash) {
        const salt = await bcryptjs.genSalt(10);
        user.password_hash = await bcryptjs.hash(user.password_hash, salt);
    }
});

// Hash password before updating (only if password_hash is being changed)
User.beforeUpdate(async (user) => {
    if (user.changed('password_hash') && user.password_hash) {
        const salt = await bcryptjs.genSalt(10);
        user.password_hash = await bcryptjs.hash(user.password_hash, salt);
    }
});

// Method to compare passwords
User.prototype.comparePassword = async function (passwordToCheck) {
    return bcryptjs.compare(passwordToCheck, this.password_hash);
};

module.exports = User;
