const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const KioskSyncLog = sequelize.define(
    'KioskSyncLog',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        payload: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: 'Toàn bộ dữ liệu JSON gốc từ kiosk',
        },
    },
    {
        tableName: 'kiosk_sync_logs',
        timestamps: true,
        underscored: true,
        updatedAt: false, // Chỉ có created_at
    }
);

module.exports = KioskSyncLog;
