const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const EBoard = require('./EBoard');

const EBoardMedia = sequelize.define(
    'EBoardMedia',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        e_board_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'e_boards',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        file_type: {
            type: DataTypes.ENUM('image', 'video'),
            allowNull: false,
        },
        file_url: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'Đường dẫn file',
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Mô tả file (Tiếng Việt)',
        },
        sort_order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Thứ tự chạy slide',
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'e_board_media',
    }
);

EBoardMedia.belongsTo(EBoard, { foreignKey: 'e_board_id', targetKey: 'id' });
EBoard.hasMany(EBoardMedia, { foreignKey: 'e_board_id', sourceKey: 'id' });

module.exports = EBoardMedia;
