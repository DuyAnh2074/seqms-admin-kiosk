const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Counter = require('./Counter');
const Service = require('./Service');

const CounterPriorityService = sequelize.define(
    'CounterPriorityService',
    {
        counter_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: 'counters',
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
        priority_level: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            comment: '1: Cao nhất',
        },
    },
    {
        timestamps: false,
        tableName: 'counter_priority_services',
    }
);

// Note: Associations are defined in init-models.js

module.exports = CounterPriorityService;
