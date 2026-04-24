const { sequelize } = require('../config/db');
const { Counter, CounterPriorityService, CounterSession, TransactionOffice, Province, District, Service, User, EBoardCounter } = require('../models');
const { emitCounterForceLogout, emitCounterConfigUpdated } = require('../socket');

const OFFICE_REACTIVATE_GUARD_MESSAGE = 'Không thể khôi phục thiết bị/nhân viên này vì Phòng Giao Dịch trực thuộc đang bị vô hiệu hóa. Vui lòng khôi phục Phòng Giao Dịch trước.';

const buildDuplicateCounterCodeError = () => {
    const error = new Error('Mã quầy đã tồn tại trong phòng giao dịch này');
    error.statusCode = 409;
    return error;
};

const normalizeCode = (code) => (code || '').trim();

/**
 * Get all counters with related data
 * @param {number|null} serviceId - Filter by service ID (optional)
 * @param {number|null} officeId - Filter by office ID (optional)
 * @param {boolean} activeOnly - If true, return only active counters
 */
const getAllCounters = async (serviceId = null, officeId = null, activeOnly = false) => {
    let counters;

    if (serviceId) {
        // Filter counters that serve this service
        const counterIds = await CounterPriorityService.findAll({
            where: { service_id: serviceId },
            attributes: ['counter_id'],
        });

        const counterIdList = [...new Set(counterIds.map((cp) => cp.counter_id))];

        if (counterIdList.length === 0) {
            return [];
        }

        // Build where clause
        const whereClause = { id: counterIdList };
        if (officeId) {
            whereClause.transaction_office_id = officeId;
        }
        if (activeOnly) {
            whereClause.is_active = true;
        }

        counters = await Counter.findAll({
            where: whereClause,
            include: [
                {
                    model: TransactionOffice,
                    as: 'TransactionOffice',
                    attributes: ['id', 'name', 'district_id'],
                    include: [
                        {
                            model: District,
                            attributes: ['id', 'name', 'province_id'],
                            include: [
                                {
                                    model: Province,
                                    attributes: ['id', 'name'],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [['id', 'ASC']],
        });
    } else {
        // Get all counters that have configured services (in counter_priority_services)
        const configuredCounterIds = await CounterPriorityService.findAll({
            attributes: ['counter_id'],
            group: ['counter_id'],
        });

        const counterIdList = [...new Set(configuredCounterIds.map((cp) => cp.counter_id))];

        // Build where clause
        const whereClause = counterIdList.length > 0 ? { id: counterIdList } : {};
        if (officeId) {
            whereClause.transaction_office_id = officeId;
        }
        if (activeOnly) {
            whereClause.is_active = true;
        }

        counters = await Counter.findAll({
            where: whereClause,
            include: [
                {
                    model: TransactionOffice,
                    as: 'TransactionOffice',
                    attributes: ['id', 'name', 'district_id'],
                    include: [
                        {
                            model: District,
                            attributes: ['id', 'name', 'province_id'],
                            include: [
                                {
                                    model: Province,
                                    attributes: ['id', 'name'],
                                },
                            ],
                        },
                    ],
                },
            ],
            order: [['id', 'ASC']],
        });
    }

    // Get services for each counter
    const countersWithServices = await Promise.all(
        counters.map(async (counter) => {
            const services = await CounterPriorityService.findAll({
                where: { counter_id: counter.id },
                include: [
                    {
                        model: Service,
                        as: 'Service',
                        attributes: ['id', 'name', 'code', 'is_active'],
                    },
                ],
            });

            const activeServices = services.filter((cs) => cs.Service?.is_active === true);

            return {
                id: counter.id,
                code: counter.code,
                name: counter.name,
                led_number: counter.led_number,
                is_active: counter.is_active,
                transaction_office_id: counter.transaction_office_id,
                transaction_office: counter.TransactionOffice,
                created_at: counter.created_at,
                services: services.map((cs) => ({
                    service_id: cs.service_id,
                    service_name: cs.Service?.name || '',
                    service_code: cs.Service?.code || '',
                    service_is_active: cs.Service?.is_active === true,
                    priority_level: cs.priority_level,
                })),
                service_ids: services.map((cs) => cs.service_id),
                service_count: activeServices.length,
                priority_count: activeServices.filter((s) => s.priority_level === 1).length,
            };
        })
    );

    return countersWithServices;
};

/**
 * Get counter by ID
 */
const getCounterById = async (id) => {
    const counter = await Counter.findByPk(id, {
        include: [
            {
                model: TransactionOffice,
                as: 'TransactionOffice',
                attributes: ['id', 'name', 'district_id'],
                include: [
                    {
                        model: District,
                        attributes: ['id', 'name', 'province_id'],
                    },
                ],
            },
        ],
    });

    if (!counter) {
        throw new Error('Không tìm thấy quầy');
    }

    // Get services
    const services = await CounterPriorityService.findAll({
        where: { counter_id: id },
        include: [
            {
                model: Service,
                as: 'Service',
                attributes: ['id', 'name', 'code', 'is_active'],
            },
        ],
    });

    return {
        ...counter.toJSON(),
        services: services.map((cs) => ({
            service_id: cs.service_id,
            service_name: cs.Service?.name || '',
            service_code: cs.Service?.code || '',
            service_is_active: cs.Service?.is_active === true,
            priority_level: cs.priority_level,
        })),
        service_ids: services.map((cs) => cs.service_id),
    };
};

/**
 * Create new counter with services
 */
const createCounter = async (data) => {
    const transaction = await sequelize.transaction();

    try {
        const { code, name, led_number, transaction_office_id, services } = data;
        const normalizedCode = normalizeCode(code);

        const existingCounter = await Counter.findOne({
            where: {
                transaction_office_id,
                code: normalizedCode,
            },
            transaction,
        });

        if (existingCounter) {
            throw buildDuplicateCounterCodeError();
        }

        // 1. Create counter
        const counter = await Counter.create(
            {
                code: normalizedCode,
                name,
                led_number: led_number || 0,
                transaction_office_id,
                is_active: true,
            },
            { transaction }
        );

        // 2. Create counter services
        if (services && services.length > 0) {
            const counterServices = services.map((service) => ({
                counter_id: counter.id,
                service_id: service.service_id,
                priority_level: service.priority_level || 1,
            }));

            await CounterPriorityService.bulkCreate(counterServices, { transaction });
        }

        await transaction.commit();

        // Get counter data after transaction is committed
        return await getCounterById(counter.id);
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * Update counter with services
 */
const updateCounter = async (id, data) => {
    const transaction = await sequelize.transaction();

    try {
        const counter = await Counter.findByPk(id);

        if (!counter) {
            throw new Error('Không tìm thấy quầy');
        }

        const { code, name, led_number, transaction_office_id, services } = data;
        const normalizedCode = normalizeCode(code);

        const existingCounter = await Counter.findOne({
            where: {
                transaction_office_id,
                code: normalizedCode,
            },
            transaction,
        });

        if (existingCounter && existingCounter.id !== id) {
            throw buildDuplicateCounterCodeError();
        }

        // 1. Update counter
        await counter.update(
            {
                code: normalizedCode,
                name,
                led_number: led_number || 0,
                transaction_office_id,
            },
            { transaction }
        );

        // 2. Delete old counter services
        await CounterPriorityService.destroy({
            where: { counter_id: id },
            transaction,
        });

        // 3. Create new counter services
        if (services && services.length > 0) {
            const counterServices = services.map((service) => ({
                counter_id: id,
                service_id: service.service_id,
                priority_level: service.priority_level || 1,
            }));

            await CounterPriorityService.bulkCreate(counterServices, { transaction });
        }

        await transaction.commit();

        emitCounterConfigUpdated(id, {
            reason: 'COUNTER_CONFIG_UPDATED',
            service_ids: services && services.length > 0
                ? services.map((service) => Number(service.service_id)).filter((serviceId) => Number.isInteger(serviceId))
                : [],
        });

        // Get counter data after transaction is committed
        return await getCounterById(id);
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * Deactivate counter (Soft Delete)
 * - Set is_active = false
 * - Force close active counter sessions
 * - Emit force logout signal for active staff at this counter
 */
const deleteCounter = async (id) => {
    const transaction = await sequelize.transaction();

    try {
        const counter = await Counter.findByPk(id);

        if (!counter) {
            throw new Error('Không tìm thấy quầy');
        }

        const now = new Date();

        // Close active sessions immediately
        await CounterSession.update({
            status: 'ended',
            logout_time: now,
        }, {
            where: {
                counter_id: id,
                status: 'active',
            },
            transaction,
        });

        await counter.update({
            is_active: false,
        }, {
            transaction,
        });

        await transaction.commit();

        emitCounterForceLogout(counter.id, {
            counter_id: counter.id,
            counter_code: counter.code,
            message: 'Quầy đã bị vô hiệu hóa. Phiên làm việc đã kết thúc.',
            reason: 'COUNTER_DEACTIVATED',
            force_logout: true,
        });

        return { message: 'Vô hiệu hóa quầy thành công' };
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
};

/**
 * Reactivate counter
 */
const reactivateCounter = async (id) => {
    const counter = await Counter.findByPk(id);

    if (!counter) {
        throw new Error('Không tìm thấy quầy');
    }

    const office = await TransactionOffice.findByPk(counter.transaction_office_id, {
        attributes: ['id', 'is_active'],
    });

    if (!office || office.is_active === false) {
        const error = new Error(OFFICE_REACTIVATE_GUARD_MESSAGE);
        error.statusCode = 400;
        throw error;
    }

    await counter.update({
        is_active: true,
    });

    return { message: 'Khôi phục quầy thành công' };
};

/**
 * Get counter session status
 * Check if a counter has an active session
 */
const getCounterSessionStatus = async (counterId) => {
    try {
        const counter = await Counter.findByPk(counterId);

        if (!counter) {
            throw new Error('Không tìm thấy quầy');
        }

        // Find active session for this counter
        const activeSession = await CounterSession.findOne({
            where: {
                counter_id: counterId,
                status: 'active', // Only check active sessions
                logout_time: null, // Not logged out
            },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'full_name'],
                },
            ],
        });

        return {
            hasActiveSession: !!activeSession,
            sessionInfo: activeSession ? {
                sessionId: activeSession.id,
                counterId: activeSession.counter_id,
                userId: activeSession.user_id,
                username: activeSession.User?.username,
                userFullName: activeSession.User?.full_name,
                loginTime: activeSession.login_time,
                status: activeSession.status,
                totalServed: activeSession.total_served,
            } : null,
        };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    getAllCounters,
    getCounterById,
    createCounter,
    updateCounter,
    deleteCounter,
    reactivateCounter,
    getCounterSessionStatus,
};
