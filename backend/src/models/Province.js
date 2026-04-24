const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Province = sequelize.define(
    'Province',
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
            comment: 'Mã tỉnh',
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên tỉnh (Tiếng Việt)',
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'provinces',
    }
);

module.exports = Province;
