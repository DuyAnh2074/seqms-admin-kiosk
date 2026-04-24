const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const TicketFormat = sequelize.define(
    'TicketFormat',
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
        template_format: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Ví dụ: A%03d',
        },
        min_number: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        max_number: {
            type: DataTypes.INTEGER,
            defaultValue: 999,
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
        tableName: 'ticket_formats',
    }
);

module.exports = TicketFormat;
