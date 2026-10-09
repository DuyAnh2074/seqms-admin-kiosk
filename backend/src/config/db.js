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
        pool: {
            max: 10,
            min: 2,
            acquire: 30000,
            idle: 30000,
            evict: 15000,
        },
        define: {
            freezeTableName: true,
            underscored: true,
        },
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
            keepAlive: true,
            statement_timeout: 30000,
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

        if (process.env.NODE_ENV !== 'production') {
            // Sync models only during development; production uses migrations.
            await sequelize.sync({ force: false });
            console.log('✅ Database models synced');
        } else {
            console.log('ℹ️ Skipping database sync in production');
        }

        return true;
    } catch (error) {
        console.error('❌ PostgreSQL connection error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
};

const pingDatabase = async () => {
    try {
        await sequelize.query('SELECT 1');
        console.log('✅ Database keep-alive ping succeeded');
    } catch (error) {
        console.error('❌ Database keep-alive ping failed:', error.message);
    }
};

module.exports = { Sequelize, sequelize, connectPostgres, pingDatabase, Op };
