const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const TransactionOffice = require('./TransactionOffice');

const EBoard = sequelize.define(
    'EBoard',
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
            onDelete: 'CASCADE',
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        display_video: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'True: Hiện video, False: Chỉ hiện ảnh',
        },
        voice_call_number: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Cấu hình giọng đọc (Hà Nội, Sài Gòn...)',
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
        tableName: 'e_boards',
    }
);

EBoard.belongsTo(TransactionOffice, { foreignKey: 'transaction_office_id', targetKey: 'id' });
TransactionOffice.hasMany(EBoard, { foreignKey: 'transaction_office_id', sourceKey: 'id' });

module.exports = EBoard;
