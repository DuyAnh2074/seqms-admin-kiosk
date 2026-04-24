const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * KioskServiceGroup Model - Junction table M2M between Kiosk and ServiceGroup
 */
const KioskServiceGroup = sequelize.define(
    'KioskServiceGroup',
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
        service_group_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'service_groups',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
    },
    {
        timestamps: false,
        tableName: 'kiosk_service_groups',
    }
);

module.exports = KioskServiceGroup;
