const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const TicketFormat = require('./TicketFormat');

const Service = sequelize.define(
    'Service',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        ticket_format_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'ticket_formats',
                key: 'id',
            },
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Tên dịch vụ (Tiếng Việt)',
        },
        icon_url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Đường dẫn ảnh icon',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            comment: 'Trạng thái hoạt động',
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
        tableName: 'services',
    }
);

Service.belongsTo(TicketFormat, { foreignKey: 'ticket_format_id', targetKey: 'id' });
TicketFormat.hasMany(Service, { foreignKey: 'ticket_format_id', sourceKey: 'id' });

module.exports = Service;
