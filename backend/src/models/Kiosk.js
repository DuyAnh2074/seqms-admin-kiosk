const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const TransactionOffice = require('./TransactionOffice');

const Kiosk = sequelize.define(
    'Kiosk',
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
            comment: 'Tên Kiosk',
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
            comment: 'IP để nhận diện thiết bị',
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'active',
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
        tableName: 'kiosks',
    }
);

Kiosk.belongsTo(TransactionOffice, { foreignKey: 'transaction_office_id', targetKey: 'id' });
TransactionOffice.hasMany(Kiosk, { foreignKey: 'transaction_office_id', sourceKey: 'id' });

module.exports = Kiosk;
