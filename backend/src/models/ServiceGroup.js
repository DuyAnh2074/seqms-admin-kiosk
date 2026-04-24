const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ServiceGroup = sequelize.define(
    'ServiceGroup',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên nhóm (Tiếng Việt)',
        },
        icon_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Trạng thái hoạt động',
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'service_groups',
    }
);

module.exports = ServiceGroup;
