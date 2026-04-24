const TransactionOffice = require('../models/TransactionOffice');
const District = require('../models/District');
const Province = require('../models/Province');
const Kiosk = require('../models/Kiosk');
const Counter = require('../models/Counter');
const EBoard = require('../models/EBoard');
const User = require('../models/User');
const OfficeService = require('../models/OfficeService');
const OfficeServiceGroup = require('../models/OfficeServiceGroup');
const CounterSession = require('../models/CounterSession');
const { sequelize, Op } = require('../config/db');
const { emitCounterForceLogout } = require('../socket');

const closeOfficeCounterSessions = async (officeId, transaction) => {
    const now = new Date();

    const activeSessions = await CounterSession.findAll({
        where: {
            transaction_office_id: officeId,
            status: {
                [Op.in]: ['active', 'paused'],
            },
        },
        attributes: ['id', 'counter_id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
    });

    if (activeSessions.length > 0) {
        await CounterSession.update(
            {
                status: 'ended',
                logout_time: now,
            },
            {
                where: {
                    id: activeSessions.map((session) => session.id),
                },
                transaction,
            }
        );
    }

    return activeSessions;
};

const deactivateOfficeDevices = async (officeId, transaction) => {
    const counters = await Counter.findAll({
        where: { transaction_office_id: officeId },
        attributes: ['id', 'code'],
        transaction,
    });

    await Kiosk.update(
        {
            is_active: false,
            status: 'inactive',
        },
        {
            where: { transaction_office_id: officeId },
            transaction,
        }
    );

    await Counter.update(
        { is_active: false },
        {
            where: { transaction_office_id: officeId },
            transaction,
        }
    );

    await EBoard.update(
        { is_active: false },
        {
            where: { transaction_office_id: officeId },
            transaction,
        }
    );

    return counters;
};

const runOfficeDisableCascade = async (office, transaction) => {
    const [kiosksBefore, countersBefore, eboardsBefore] = await Promise.all([
        Kiosk.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active', 'status'],
            transaction,
        }),
        Counter.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active'],
            transaction,
        }),
        EBoard.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active'],
            transaction,
        }),
    ]);

    const affectedCounters = await deactivateOfficeDevices(office.id, transaction);
    const closedSessions = await closeOfficeCounterSessions(office.id, transaction);
    await office.update({ is_active: false }, { transaction });

    const [kiosksAfter, countersAfter, eboardsAfter] = await Promise.all([
        Kiosk.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active', 'status'],
            transaction,
        }),
        Counter.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active'],
            transaction,
        }),
        EBoard.findAll({
            where: { transaction_office_id: office.id },
            attributes: ['id', 'code', 'name', 'is_active'],
            transaction,
        }),
    ]);

    const stillActive = {
        kiosks: kiosksAfter.filter((item) => item.is_active !== false),
        counters: countersAfter.filter((item) => item.is_active !== false),
        eboards: eboardsAfter.filter((item) => item.is_active !== false),
    };

    if (stillActive.kiosks.length > 0 || stillActive.counters.length > 0 || stillActive.eboards.length > 0) {
        throw new Error('Dữ liệu không nhất quán: PGD đã vô hiệu hóa nhưng vẫn còn thiết bị active');
    }

    return {
        before: {
            kiosks: kiosksBefore.map((item) => item.toJSON()),
            counters: countersBefore.map((item) => item.toJSON()),
            eboards: eboardsBefore.map((item) => item.toJSON()),
        },
        after: {
            kiosks: kiosksAfter.map((item) => item.toJSON()),
            counters: countersAfter.map((item) => item.toJSON()),
            eboards: eboardsAfter.map((item) => item.toJSON()),
        },
        affected_devices: {
            kiosks: kiosksAfter.length,
            counters: countersAfter.length,
            eboards: eboardsAfter.length,
            closed_sessions: closedSessions.length,
        },
        affectedCounters,
    };
};

/**
 * Get all transaction offices with district and province information
 * Response: Flat data with id, code, name, address, district_name, province_name, coordinates, status, created_at
 * Sorted by id ASC (oldest first)
 * @param {number} districtId - Optional filter by district_id
 * @param {boolean} activeOnly - If true, only return offices where is_active = true
 */
const getAllTransactionOffices = async (districtId = null, activeOnly = false) => {
    try {
        let whereClause = {};

        if (districtId) {
            whereClause.district_id = districtId;
        }

        // Filter by active status if requested (for Kiosk/Counter clients)
        if (activeOnly) {
            whereClause.is_active = true;
        }

        const offices = await TransactionOffice.findAll({
            where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
            include: [
                {
                    model: District,
                    attributes: ['id', 'name'],
                    required: true,
                    include: [
                        {
                            model: Province,
                            attributes: ['id', 'name'],
                            required: true,
                        }
                    ]
                }
            ],
            order: [['id', 'ASC']],
        });

        // Transform to flat response
        return offices.map(office => ({
            id: office.id,
            code: office.code,
            name: office.name,
            address: office.address,
            district_id: office.district_id,
            district_name: office.District?.name || '',
            province_id: office.District?.Province?.id || '',
            province_name: office.District?.Province?.name || '',
            coordinates: office.latitude && office.longitude
                ? `${office.latitude}, ${office.longitude}`
                : '',
            latitude: office.latitude,
            longitude: office.longitude,
            status: office.is_active ? 'Active' : 'Inactive',
            is_active: office.is_active,
            created_at: office.created_at,
        }));
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách phòng giao dịch: ${error.message}`);
    }
};

/**
 * Get transaction office by ID with district and province information
 * Includes province_id for Frontend to populate cascading dropdown
 */
const getTransactionOfficeById = async (id) => {
    try {
        const office = await TransactionOffice.findByPk(id, {
            include: [
                {
                    model: District,
                    attributes: ['id', 'name'],
                    required: true,
                    include: [
                        {
                            model: Province,
                            attributes: ['id', 'name'],
                            required: true,
                        }
                    ]
                }
            ],
        });

        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        // Transform to detailed response with province_id for cascading dropdown
        return {
            id: office.id,
            code: office.code,
            name: office.name,
            address: office.address,
            district_id: office.district_id,
            district_name: office.District?.name || '',
            province_id: office.District?.Province?.id || '',
            province_name: office.District?.Province?.name || '',
            latitude: office.latitude,
            longitude: office.longitude,
            coordinates: office.latitude && office.longitude
                ? `${office.latitude}, ${office.longitude}`
                : '',
            status: office.is_active ? 'Active' : 'Inactive',
            is_active: office.is_active,
            created_at: office.created_at,
            updated_at: office.updated_at,
        };
    } catch (error) {
        throw new Error(`Lỗi khi tải phòng giao dịch: ${error.message}`);
    }
};

/**
 * Create new transaction office
 * Input: district_id, code, name, address, latitude, longitude
 */
const createTransactionOffice = async (district_id, code, name, address, latitude, longitude) => {
    try {
        // Validation
        if (!district_id || !code || !name) {
            throw new Error('Mã xã/phường, mã và tên là bắt buộc');
        }

        // Check if district exists
        const district = await District.findByPk(district_id);
        if (!district) {
            throw new Error('Không tìm thấy xã/phường');
        }

        // Check if code already exists
        const existingOffice = await TransactionOffice.findOne({
            where: { code }
        });

        if (existingOffice) {
            throw new Error(`Mã "${code}" đã tồn tại`);
        }

        // Create new transaction office
        const newOffice = await TransactionOffice.create({
            district_id: district_id,
            code: code,
            name: name,
            address: address || null,
            latitude: latitude || null,
            longitude: longitude || null,
            is_active: true,
        });

        // Return with district and province info
        return await getTransactionOfficeById(newOffice.id);
    } catch (error) {
        throw new Error(`Lỗi khi tạo phòng giao dịch: ${error.message}`);
    }
};

/**
 * Update transaction office
 * Can update: district_id, code, name, address, latitude, longitude, is_active
 */
const updateTransactionOffice = async (id, updateData) => {
    const transaction = await sequelize.transaction();

    try {
        const office = await TransactionOffice.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        // Validation
        const { district_id, code, name, address, latitude, longitude, is_active } = updateData;

        // Check if new district exists (if provided)
        if (district_id && district_id !== office.district_id) {
            const district = await District.findByPk(district_id, { transaction });
            if (!district) {
                throw new Error('Không tìm thấy xã/phường');
            }
        }

        // Check if new code already exists (if changed)
        if (code && code !== office.code) {
            const existingOffice = await TransactionOffice.findOne({
                where: { code },
                transaction,
            });
            if (existingOffice) {
                throw new Error(`Mã "${code}" đã tồn tại`);
            }
        }

        const shouldDisableCascade = office.is_active && is_active === false;

        // Update the office
        await office.update({
            district_id: district_id !== undefined ? district_id : office.district_id,
            code: code !== undefined ? code : office.code,
            name: name !== undefined ? name : office.name,
            address: address !== undefined ? address : office.address,
            latitude: latitude !== undefined ? latitude : office.latitude,
            longitude: longitude !== undefined ? longitude : office.longitude,
            is_active: is_active !== undefined ? is_active : office.is_active,
        }, { transaction });

        let cascadeResult = null;
        if (shouldDisableCascade) {
            cascadeResult = await runOfficeDisableCascade(office, transaction);
        }

        await transaction.commit();

        if (cascadeResult) {
            for (const counter of cascadeResult.affectedCounters) {
                emitCounterForceLogout(counter.id, {
                    counter_id: counter.id,
                    counter_code: counter.code,
                    message: 'Phòng giao dịch đã bị vô hiệu hóa. Phiên làm việc đã kết thúc.',
                    reason: 'OFFICE_DEACTIVATED',
                    force_logout: true,
                });
            }
        }

        return await getTransactionOfficeById(office.id);
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw new Error(`Lỗi khi cập nhật phòng giao dịch: ${error.message}`);
    }
};

/**
 * Deactivate transaction office (Soft Delete)
 * Cascade deactivation: When a transaction office is deactivated,
 * all related kiosks, counters, and e_boards are also deactivated
 */
const deleteTransactionOffice = async (id) => {
    const transaction = await sequelize.transaction();

    try {
        const office = await TransactionOffice.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        const cascadeResult = await runOfficeDisableCascade(office, transaction);
        await transaction.commit();

        for (const counter of cascadeResult.affectedCounters) {
            emitCounterForceLogout(counter.id, {
                counter_id: counter.id,
                counter_code: counter.code,
                message: 'Phòng giao dịch đã bị vô hiệu hóa. Phiên làm việc đã kết thúc.',
                reason: 'OFFICE_DEACTIVATED',
                force_logout: true,
            });
        }

        return {
            id: id,
            message: 'Vô hiệu hóa phòng giao dịch và tất cả thiết bị liên quan thành công',
            before: cascadeResult.before,
            after: cascadeResult.after,
            affected_devices: cascadeResult.affected_devices,
            result: 'PASS',
        };
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw new Error(`Lỗi khi vô hiệu hóa phòng giao dịch: ${error.message}`);
    }
};

/**
 * Reactivate transaction office
 * Note: This only reactivates the office itself, not related devices
 * Devices need to be manually reactivated if needed
 */
const reactivateTransactionOffice = async (id) => {
    try {
        const office = await TransactionOffice.findByPk(id);
        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        // Reactivate the transaction office
        await office.update({ is_active: true });

        return {
            id: id,
            message: 'Khôi phục phòng giao dịch thành công. Lưu ý: Thiết bị cần được kích hoạt riêng.'
        };
    } catch (error) {
        throw new Error(`Lỗi khi khôi phục phòng giao dịch: ${error.message}`);
    }
};

/**
 * Get districts filtered by province_id (for cascading dropdown)
 */
const getDistrictsByProvince = async (province_id) => {
    try {
        if (!province_id) {
            throw new Error('Mã tỉnh/thành phố là bắt buộc');
        }

        const districts = await District.findAll({
            where: { province_id: province_id },
            attributes: ['id', 'code', 'name'],
            order: [['id', 'ASC']],
        });

        return districts;
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách xã/phường: ${error.message}`);
    }
};

module.exports = {
    getAllTransactionOffices,
    getTransactionOfficeById,
    createTransactionOffice,
    updateTransactionOffice,
    deleteTransactionOffice,
    reactivateTransactionOffice,
    getDistrictsByProvince,
};
