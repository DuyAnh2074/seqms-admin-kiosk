/**
 * Initialize all model associations
 * This centralizes all Sequelize associations in one place for better organization
 */
const models = require('./index');

function initializeAssociations() {
    const {
        Province,
        District,
        TransactionOffice,
        TicketFormat,
        Service,
        ServiceGroup,
        ServiceGroupItem,
        Kiosk,
        KioskService,
        KioskServiceGroup,
        Counter,
        CounterPriorityService,
        EBoard,
        EBoardMedia,
        User,
        Transaction,
        OfficeService,
        OfficeServiceGroup,
        CounterSession,
        Customer,
    } = models;

    // ===== Kiosk M2M Associations =====
    // Kiosk belongsToMany Service through KioskService
    Kiosk.belongsToMany(Service, {
        through: KioskService,
        foreignKey: 'kiosk_id',
        otherKey: 'service_id',
        as: 'Services',
        timestamps: false,
    });

    Service.belongsToMany(Kiosk, {
        through: KioskService,
        foreignKey: 'service_id',
        otherKey: 'kiosk_id',
        as: 'AssignedKiosks',
        timestamps: false,
    });

    // Kiosk belongsToMany ServiceGroup through KioskServiceGroup
    Kiosk.belongsToMany(ServiceGroup, {
        through: KioskServiceGroup,
        foreignKey: 'kiosk_id',
        otherKey: 'service_group_id',
        as: 'ServiceGroups',
        timestamps: false,
    });

    ServiceGroup.belongsToMany(Kiosk, {
        through: KioskServiceGroup,
        foreignKey: 'service_group_id',
        otherKey: 'kiosk_id',
        as: 'AssignedKiosks',
        timestamps: false,
    });

    // ===== User Associations =====
    // User belongsTo TransactionOffice
    User.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    // ===== Counter Associations =====
    // Counter belongsTo TransactionOffice
    Counter.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    TransactionOffice.hasMany(Counter, {
        foreignKey: 'transaction_office_id',
    });

    // Counter belongsToMany Service through CounterPriorityService
    Counter.belongsToMany(Service, {
        through: CounterPriorityService,
        foreignKey: 'counter_id',
        otherKey: 'service_id',
        as: 'Services',
    });

    Service.belongsToMany(Counter, {
        through: CounterPriorityService,
        foreignKey: 'service_id',
        otherKey: 'counter_id',
        as: 'AssignedCounters',
    });

    // Direct associations for CounterPriorityService (for eager loading)
    CounterPriorityService.belongsTo(Counter, {
        foreignKey: 'counter_id',
        as: 'Counter',
    });

    CounterPriorityService.belongsTo(Service, {
        foreignKey: 'service_id',
        as: 'Service',
    });

    // ===== OfficeService Associations =====
    // OfficeService belongsTo TransactionOffice
    OfficeService.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    // OfficeService belongsTo Service
    OfficeService.belongsTo(Service, {
        foreignKey: 'service_id',
        as: 'Service',
    });

    // ===== OfficeServiceGroup Associations =====
    // OfficeServiceGroup belongsTo TransactionOffice
    OfficeServiceGroup.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    // OfficeServiceGroup belongsTo ServiceGroup
    OfficeServiceGroup.belongsTo(ServiceGroup, {
        foreignKey: 'service_group_id',
        as: 'ServiceGroup',
    });

    // ===== CounterSession Associations =====
    // CounterSession belongsTo User
    CounterSession.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'User',
    });

    // CounterSession belongsTo Counter
    CounterSession.belongsTo(Counter, {
        foreignKey: 'counter_id',
        as: 'Counter',
    });

    // CounterSession belongsTo TransactionOffice
    CounterSession.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    // User hasMany CounterSession
    User.hasMany(CounterSession, {
        foreignKey: 'user_id',
        as: 'Sessions',
    });

    // Counter hasMany CounterSession
    Counter.hasMany(CounterSession, {
        foreignKey: 'counter_id',
        as: 'Sessions',
    });

    // TransactionOffice hasMany CounterSession
    TransactionOffice.hasMany(CounterSession, {
        foreignKey: 'transaction_office_id',
        as: 'Sessions',
    });

    // ===== Transaction Associations =====
    // Transaction belongsTo Customer
    Transaction.belongsTo(Customer, {
        foreignKey: 'customer_id',
        as: 'Customer',
    });

    Customer.hasMany(Transaction, {
        foreignKey: 'customer_id',
    });

    // Transaction belongsTo TransactionOffice
    Transaction.belongsTo(TransactionOffice, {
        foreignKey: 'transaction_office_id',
        as: 'TransactionOffice',
    });

    TransactionOffice.hasMany(Transaction, {
        foreignKey: 'transaction_office_id',
    });

    // Transaction belongsTo Service (main service)
    Transaction.belongsTo(Service, {
        foreignKey: 'service_id',
        as: 'Service',
    });

    Service.hasMany(Transaction, {
        foreignKey: 'service_id',
    });

    // Transaction belongsTo Service (original service - for service changes)
    Transaction.belongsTo(Service, {
        foreignKey: 'original_service_id',
        as: 'OriginalService',
    });

    // Transaction belongsTo Kiosk
    Transaction.belongsTo(Kiosk, {
        foreignKey: 'kiosk_id',
        as: 'Kiosk',
    });

    Kiosk.hasMany(Transaction, {
        foreignKey: 'kiosk_id',
    });

    // Transaction belongsTo Counter
    Transaction.belongsTo(Counter, {
        foreignKey: 'counter_id',
        as: 'Counter',
    });

    Counter.hasMany(Transaction, {
        foreignKey: 'counter_id',
    });

    // Transaction belongsTo User
    Transaction.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'User',
    });

    User.hasMany(Transaction, {
        foreignKey: 'user_id',
    });
}

module.exports = { initializeAssociations };
