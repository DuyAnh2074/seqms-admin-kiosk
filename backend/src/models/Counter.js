const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const TransactionOffice = require('./TransactionOffice');

const Counter = sequelize.define(
    'Counter',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        transaction_office_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'transaction_offices',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên quầy (Ví dụ: Quầy 1)',
        },
        led_number: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Số bảng LED hiển thị',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'counters',
    }
);

module.exports = Counter;
