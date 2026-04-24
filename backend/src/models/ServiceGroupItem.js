const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const ServiceGroup = require('./ServiceGroup');
const Service = require('./Service');

const ServiceGroupItem = sequelize.define(
    'ServiceGroupItem',
    {
        service_group_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: ServiceGroup,
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        service_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            references: {
                model: Service,
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
    },
    {
        timestamps: false,
        tableName: 'service_group_items',
    }
);

// M2M associations
ServiceGroup.belongsToMany(Service, {
    through: ServiceGroupItem,
    foreignKey: 'service_group_id',
    otherKey: 'service_id',
    as: 'Services',
});

Service.belongsToMany(ServiceGroup, {
    through: ServiceGroupItem,
    foreignKey: 'service_id',
    otherKey: 'service_group_id',
    as: 'ServiceGroups',
});

// belongsTo associations for direct access
ServiceGroupItem.belongsTo(Service, {
    foreignKey: 'service_id',
    as: 'Service',
});

ServiceGroupItem.belongsTo(ServiceGroup, {
    foreignKey: 'service_group_id',
    as: 'ServiceGroup',
});

module.exports = ServiceGroupItem;
