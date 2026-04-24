const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Counter = require('./Counter');
const User = require('./User');
const TransactionOffice = require('./TransactionOffice');

const CounterSession = sequelize.define(
    'CounterSession',
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
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        counter_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'counters',
                key: 'id',
            },
        },
        session_token: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true,
            comment: 'Unique UUID token for session restoration',
        },
        login_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        logout_time: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'active',
            comment: 'active, paused, closed',
        },
        total_served: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Number of customers served in this session',
        },
        avg_waiting_time: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Average waiting time in seconds',
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
        tableName: 'counter_sessions',
    }
);

// Note: Associations are defined in init-models.js

module.exports = CounterSession;
