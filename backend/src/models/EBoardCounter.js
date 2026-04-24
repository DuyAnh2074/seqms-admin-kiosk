const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const EBoard = require('./EBoard');
const Counter = require('./Counter');

const EBoardCounter = sequelize.define(
    'EBoardCounter',
    {
        e_board_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'e_boards',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        counter_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            references: {
                model: 'counters',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
    },
    {
        timestamps: false,
        tableName: 'e_board_counters',
    }
);

// Associations
EBoardCounter.belongsTo(EBoard, { foreignKey: 'e_board_id', targetKey: 'id' });
EBoardCounter.belongsTo(Counter, { foreignKey: 'counter_id', targetKey: 'id' });

// Many-to-many through junction table
EBoard.belongsToMany(Counter, {
    through: EBoardCounter,
    foreignKey: 'e_board_id',
    otherKey: 'counter_id',
    as: 'counters'
});

Counter.belongsToMany(EBoard, {
    through: EBoardCounter,
    foreignKey: 'counter_id',
    otherKey: 'e_board_id',
    as: 'eboards'
});

module.exports = EBoardCounter;
