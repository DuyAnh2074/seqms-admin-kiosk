const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * OfficeService Model - Junction table for M2M relationship
 * between TransactionOffice and Service
 */
const OfficeService = sequelize.define(
    'OfficeService',
    {
        transaction_office_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'transaction_offices',
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
        tableName: 'office_services',
    }
);

module.exports = OfficeService;
