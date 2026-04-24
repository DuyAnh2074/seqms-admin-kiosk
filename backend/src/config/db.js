const { Sequelize, Op } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'seqms_admin',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',

    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        define: {
            freezeTableName: true,
            underscored: true,
        },
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        },
    }
);

const connectPostgres = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected successfully');

        // Import all models from models/index.js
        const models = require('../models');

        // Initialize model associations
        const { initializeAssociations } = require('../models/init-models');
        initializeAssociations();

        // Sync all models with database (force: false để không xóa dữ liệu)
        await sequelize.sync({ force: false });
        console.log('✅ Database models synced');

        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
};

module.exports = { Sequelize, sequelize, connectPostgres, Op };
