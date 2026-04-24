const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Province = require('./Province');

const District = sequelize.define(
    'District',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        province_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'provinces',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Mã quận',
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên quận (Tiếng Việt)',
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        timestamps: false,
        tableName: 'districts',
        uniqueKeys: {
            province_code: {
                fields: ['province_id', 'code'],
            },
        },
    }
);

District.belongsTo(Province, { foreignKey: 'province_id', targetKey: 'id' });
Province.hasMany(District, { foreignKey: 'province_id', sourceKey: 'id' });

module.exports = District;
