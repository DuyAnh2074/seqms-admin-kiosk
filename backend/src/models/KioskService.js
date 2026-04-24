const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * KioskService Model - Junction table M2M between Kiosk and Service
 */
const KioskService = sequelize.define(
    'KioskService',
    {
        kiosk_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'kiosks',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        service_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'services',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
    },
    {
        timestamps: false,
        tableName: 'kiosk_services',
    }
);

module.exports = KioskService;
