const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const OfficeServiceGroup = sequelize.define(
    'OfficeServiceGroup',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        transaction_office_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'ID của Phòng Giao Dịch',
            references: {
                model: 'transaction_offices',
                key: 'id',
            },
        },
        service_group_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'ID của Nhóm Dịch Vụ',
            references: {
                model: 'service_groups',
                key: 'id',
            },
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'office_service_groups',
        indexes: [
            {
                unique: true,
                fields: ['transaction_office_id', 'service_group_id'],
            }
        ]
    }
);

module.exports = OfficeServiceGroup;
