const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const District = require('./District');

const TransactionOffice = sequelize.define(
    'TransactionOffice',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        district_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'districts',
                key: 'id',
            },
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: 'Mã chi nhánh',
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên chi nhánh (Tiếng Việt)',
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Địa chỉ chi tiết',
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: true,
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        waiting_warning_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: 'Cảnh báo đợi lâu (phút)',
        },
        waiting_overdue_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: 'Lỗi đợi quá lâu (phút)',
        },
        serving_warning_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: 'Cảnh báo phục vụ lâu (phút)',
        },
        serving_overdue_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
            comment: 'Lỗi phục vụ quá lâu (phút)',
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
        tableName: 'transaction_offices',
    }
);

TransactionOffice.belongsTo(District, { foreignKey: 'district_id', targetKey: 'id' });
District.hasMany(TransactionOffice, { foreignKey: 'district_id', sourceKey: 'id' });

module.exports = TransactionOffice;
