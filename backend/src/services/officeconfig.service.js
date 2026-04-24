const { sequelize, Op } = require('../config/db');
const TransactionOffice = require('../models/TransactionOffice');
const Service = require('../models/Service');
const OfficeService = require('../models/OfficeService');
const ServiceGroup = require('../models/ServiceGroup');
const ServiceGroupItem = require('../models/ServiceGroupItem');
const OfficeServiceGroup = require('../models/OfficeServiceGroup');
const Kiosk = require('../models/Kiosk');
const KioskService = require('../models/KioskService');
const KioskServiceGroup = require('../models/KioskServiceGroup');
const Counter = require('../models/Counter');
const CounterPriorityService = require('../models/CounterPriorityService');

/**
 * Check if services/groups are actively used by Kiosks/Counters in the office
 * Returns: { inUse: boolean, conflicts: [ { type: 'kiosk'|'counter', id, name, serviceNames }, ... ] }
 */
const checkServiceUsageInDevices = async (officeId, removedServiceIds, removedGroupIds) => {
    try {
        const conflicts = [];

        // 1. Check Kiosk devices using removed services
        if (removedServiceIds.length > 0) {
            const kioskServicesInUse = await KioskService.findAll({
                where: { service_id: removedServiceIds },
                attributes: ['kiosk_id', 'service_id'],
                raw: true,
            });

            // Get kiosk details for each found record
            for (const ks of kioskServicesInUse) {
                const kiosk = await Kiosk.findOne({
                    where: {
                        id: ks.kiosk_id,
                        transaction_office_id: officeId
                    },
                    attributes: ['id', 'name'],
                    raw: true,
                });

                if (kiosk) {
                    const service = await Service.findByPk(ks.service_id, {
                        attributes: ['name'],
                        raw: true,
                    });

                    const existing = conflicts.find(c => c.type === 'kiosk' && c.id === kiosk.id);
                    if (existing) {
                        if (service && !existing.serviceNames.includes(service.name)) {
                            existing.serviceNames.push(service.name);
                        }
                    } else {
                        conflicts.push({
                            type: 'kiosk',
                            id: kiosk.id,
                            name: kiosk.name,
                            serviceNames: service ? [service.name] : [],
                        });
                    }
                }
            }
        }

        // 2. Check Kiosk devices using removed service groups
        if (removedGroupIds.length > 0) {
            const kioskGroupsInUse = await KioskServiceGroup.findAll({
                where: { service_group_id: removedGroupIds },
                attributes: ['kiosk_id', 'service_group_id'],
                raw: true,
            });

            // Get kiosk details for each found record
            for (const kg of kioskGroupsInUse) {
                const kiosk = await Kiosk.findOne({
                    where: {
                        id: kg.kiosk_id,
                        transaction_office_id: officeId
                    },
                    attributes: ['id', 'name'],
                    raw: true,
                });

                if (kiosk) {
                    const serviceGroup = await ServiceGroup.findByPk(kg.service_group_id, {
                        attributes: ['name'],
                        raw: true,
                    });

                    const existing = conflicts.find(c => c.type === 'kiosk' && c.id === kiosk.id);
                    if (existing) {
                        if (serviceGroup && !existing.serviceNames.includes(serviceGroup.name)) {
                            existing.serviceNames.push(serviceGroup.name);
                        }
                    } else {
                        conflicts.push({
                            type: 'kiosk',
                            id: kiosk.id,
                            name: kiosk.name,
                            serviceNames: serviceGroup ? [serviceGroup.name] : [],
                        });
                    }
                }
            }
        }

        // 3. Check Counter devices using removed services
        if (removedServiceIds.length > 0) {
            const counterServicesInUse = await CounterPriorityService.findAll({
                where: { service_id: removedServiceIds },
                attributes: ['counter_id', 'service_id'],
                raw: true,
            });

            // Get counter details for each found record
            for (const cs of counterServicesInUse) {
                const counter = await Counter.findOne({
                    where: {
                        id: cs.counter_id,
                        transaction_office_id: officeId
                    },
                    attributes: ['id', 'name'],
                    raw: true,
                });

                if (counter) {
                    const service = await Service.findByPk(cs.service_id, {
                        attributes: ['name'],
                        raw: true,
                    });

                    const existing = conflicts.find(c => c.type === 'counter' && c.id === counter.id);
                    if (existing) {
                        if (service && !existing.serviceNames.includes(service.name)) {
                            existing.serviceNames.push(service.name);
                        }
                    } else {
                        conflicts.push({
                            type: 'counter',
                            id: counter.id,
                            name: counter.name,
                            serviceNames: service ? [service.name] : [],
                        });
                    }
                }
            }
        }

        return {
            inUse: conflicts.length > 0,
            conflicts: conflicts,
        };
    } catch (error) {
        throw new Error(`Lỗi khi kiểm tra sử dụng dịch vụ: ${error.message}`);
    }
};

/**
 * Get services grouped by service group
 * Returns: [{ group_id, group_name, services: [...] }, ...]
 */
const getGroupedServices = async () => {
    try {
        // Get all service groups with their services
        const serviceGroups = await ServiceGroup.findAll({
            include: [
                {
                    model: Service,
                    through: ServiceGroupItem,
                    as: 'Services',
                    attributes: ['id', 'code', 'name'],
                    required: false,
                }
            ],
            order: [['id', 'ASC']],
            raw: false,
        });

        // Format grouped data
        const groupedServices = serviceGroups.map(group => ({
            group_id: group.id,
            group_name: group.name,
            services: (group.Services || []).map(service => ({
                id: service.id,
                code: service.code,
                name: service.name,
            })),
        }));

        // Get services that are NOT in any group (ungrouped services)
        const allServices = await Service.findAll();
        const groupedServiceIds = new Set();
        groupedServices.forEach(group => {
            group.services.forEach(service => {
                groupedServiceIds.add(service.id);
            });
        });

        const ungroupedServices = allServices
            .filter(service => !groupedServiceIds.has(service.id))
            .map(service => ({
                id: service.id,
                code: service.code,
                name: service.name,
            }));

        // Add ungrouped services as a special group
        if (ungroupedServices.length > 0) {
            groupedServices.push({
                group_id: null,
                group_name: 'Dịch vụ khác',
                services: ungroupedServices,
            });
        }

        return groupedServices;
    } catch (error) {
        throw new Error(`Lỗi khi lấy danh sách dịch vụ: ${error.message}`);
    }
};

/**
 * Get office configuration by office ID
 * Returns config details with assigned services and service groups
 */
const getOfficeConfigDetails = async (officeId) => {
    try {
        const office = await TransactionOffice.findByPk(officeId, {
            include: [
                {
                    model: require('../models/District'),
                    attributes: ['id', 'province_id'],
                    required: false,
                }
            ]
        });
        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        // Fetch assigned services
        const assignedServices = await OfficeService.findAll({
            where: { transaction_office_id: officeId },
            attributes: ['service_id'],
            raw: true,
        });

        const assignedServiceIds = assignedServices.map(item => item.service_id);

        // ✅ Fetch assigned service groups
        const assignedGroups = await OfficeServiceGroup.findAll({
            where: { transaction_office_id: officeId },
            attributes: ['service_group_id'],
            raw: true,
        });

        const assignedGroupIds = assignedGroups.map(item => item.service_group_id);

        // Get grouped services
        const groupedServices = await getGroupedServices();

        return {
            office_info: {
                id: office.id,
                name: office.name,
                code: office.code,
                province_id: office.District?.province_id,
                district_id: office.district_id,
            },
            config: {
                waiting_warning_minutes: office.waiting_warning_minutes,
                waiting_overdue_minutes: office.waiting_overdue_minutes,
                serving_warning_minutes: office.serving_warning_minutes,
                serving_overdue_minutes: office.serving_overdue_minutes,
            },
            assigned_service_ids: assignedServiceIds,
            assigned_services_count: assignedServiceIds.length,
            assigned_service_group_ids: assignedGroupIds,
            assigned_groups_count: assignedGroupIds.length,
            grouped_services: groupedServices,
        };
    } catch (error) {
        throw new Error(`Lỗi khi lấy cấu hình phòng giao dịch: ${error.message}`);
    }
};

/**
 * Get all office configs list (READ)
 * Returns list of all offices with service count summary
 */
const getAllOfficeConfigs = async () => {
    try {
        const offices = await TransactionOffice.findAll({
            include: [
                {
                    model: require('../models/District'),
                    attributes: ['id', 'name'],
                    required: false,
                    include: [
                        {
                            model: require('../models/Province'),
                            attributes: ['id', 'name'],
                            required: false,
                        }
                    ]
                }
            ],
            order: [['id', 'ASC']],
        });

        // Get service counts for each office
        const configList = await Promise.all(
            offices.map(async (office) => {
                const assignedServices = await OfficeService.findAll({
                    where: { transaction_office_id: office.id },
                    attributes: ['service_id'],
                    raw: true,
                });

                const assignedServiceGroup = await OfficeServiceGroup.findAll({
                    where: { transaction_office_id: office.id },
                    attributes: ['service_group_id'],
                    raw: true,
                });

                const assignedServiceIds = assignedServices.map((item) => item.service_id);
                const assignedServiceGroupIds = assignedServiceGroup.map((item) => item.service_group_id);

                const serviceCount = assignedServiceIds.length > 0
                    ? await Service.count({
                        where: {
                            id: { [Op.in]: assignedServiceIds },
                            is_active: true,
                        },
                    })
                    : 0;

                const serviceGroupCount = assignedServiceGroupIds.length > 0
                    ? await ServiceGroup.count({
                        where: {
                            id: { [Op.in]: assignedServiceGroupIds },
                            is_active: true,
                        },
                    })
                    : 0;

                return {
                    id: office.id,
                    code: office.code,
                    name: office.name,
                    district: office.District?.name || '',
                    district_id: office.district_id,
                    province: office.District?.Province?.name || '',
                    province_id: office.District?.Province?.id,
                    services_count: serviceCount,
                    service_groups_count: serviceGroupCount,
                    waiting_warning_minutes: office.waiting_warning_minutes,
                    waiting_overdue_minutes: office.waiting_overdue_minutes,
                    serving_warning_minutes: office.serving_warning_minutes,
                    serving_overdue_minutes: office.serving_overdue_minutes,
                    is_active: office.is_active,
                };
            })
        );

        return configList;
    } catch (error) {
        throw new Error(`Lỗi khi lấy danh sách cấu hình: ${error.message}`);
    }
};

/**
 * Save office configuration (WRITE with Transaction)
 * Input: officeId, configs (object with 4 time values), serviceIds (array), serviceGroupIds (array)
 * Transaction Logic:
 * 1. Begin Transaction
 * 2. Update time columns
 * 3. Delete old service mappings + group mappings
 * 4. Insert new service mappings + group mappings
 * 5. Commit/Rollback
 */
const saveOfficeConfig = async (officeId, configs, serviceIds, serviceGroupIds = []) => {
    try {
        // Validation
        if (!officeId || !configs || !Array.isArray(serviceIds)) {
            throw new Error('Dữ liệu không hợp lệ: officeId, configs và serviceIds là bắt buộc');
        }

        // Check if office exists
        const office = await TransactionOffice.findByPk(officeId);
        if (!office) {
            throw new Error('Không tìm thấy phòng giao dịch');
        }

        if (office.is_active === false) {
            throw new Error('Không thể thay đổi cấu hình. Phòng giao dịch này đang bị vô hiệu hóa.');
        }

        // ✅ VALIDATION BEFORE TRANSACTION: Check if removed services/groups are actively used by Kiosks/Counters
        // Get current assigned service/group IDs from database
        const currentServices = await OfficeService.findAll({
            where: { transaction_office_id: officeId },
            attributes: ['service_id'],
            raw: true,
        });
        const currentServiceIds = currentServices.map(os => os.service_id);

        const currentGroups = await OfficeServiceGroup.findAll({
            where: { transaction_office_id: officeId },
            attributes: ['service_group_id'],
            raw: true,
        });
        const currentGroupIds = currentGroups.map(og => og.service_group_id);

        // Find removed IDs
        const removedServiceIds = currentServiceIds.filter(id => !serviceIds.includes(id));
        const removedGroupIds = currentGroupIds.filter(id => !serviceGroupIds.includes(id));

        // Check if removed services/groups are used by any Kiosk/Counter
        if (removedServiceIds.length > 0 || removedGroupIds.length > 0) {
            const usageCheck = await checkServiceUsageInDevices(officeId, removedServiceIds, removedGroupIds);

            if (usageCheck.inUse) {
                const conflictMessages = usageCheck.conflicts.map(conflict => {
                    const deviceType = conflict.type === 'kiosk' ? 'Kiosk' : 'Quầy';
                    const services = conflict.serviceNames.join(', ');
                    return `${deviceType} "${conflict.name}" đang sử dụng: ${services}`;
                }).join('; ');

                throw new Error(`Không thể gỡ cấu hình: ${conflictMessages}. Vui lòng gỡ cấu hình thiết bị trước.`);
            }
        }

        // ✅ VALIDATION PASSED - NOW BEGIN TRANSACTION
        const transaction = await sequelize.transaction();

        try {
            // Step 1: Update time configurations
            const {
                waiting_warning_minutes,
                waiting_overdue_minutes,
                serving_warning_minutes,
                serving_overdue_minutes,
            } = configs;

            await office.update(
                {
                    waiting_warning_minutes: waiting_warning_minutes || null,
                    waiting_overdue_minutes: waiting_overdue_minutes || null,
                    serving_warning_minutes: serving_warning_minutes || null,
                    serving_overdue_minutes: serving_overdue_minutes || null,
                },
                { transaction }
            );

            // Step 4: Delete all existing office_services entries for this office
            await OfficeService.destroy({
                where: { transaction_office_id: officeId },
                transaction,
            });

            // Step 4b: Delete all existing office_service_groups entries for this office
            await OfficeServiceGroup.destroy({
                where: { transaction_office_id: officeId },
                transaction,
            });

            // Step 5: Insert new office_services entries for selected services
            if (serviceIds.length > 0) {
                const officeServicesToInsert = serviceIds.map(serviceId => ({
                    transaction_office_id: officeId,
                    service_id: serviceId,
                }));

                await OfficeService.bulkCreate(officeServicesToInsert, { transaction });
            }

            // Step 3b: ✅ Insert new office_service_groups entries for selected groups
            if (serviceGroupIds.length > 0) {
                const officeGroupsToInsert = serviceGroupIds.map(groupId => ({
                    transaction_office_id: officeId,
                    service_group_id: groupId,
                }));

                await OfficeServiceGroup.bulkCreate(officeGroupsToInsert, { transaction });
            }

            // Commit transaction
            await transaction.commit();

            // Return updated configuration
            return await getOfficeConfigDetails(officeId);
        } catch (error) {
            // Rollback transaction on error
            await transaction.rollback();
            throw new Error(`Lỗi khi lưu cấu hình: ${error.message}`);
        }
    } catch (error) {
        throw new Error(`Lỗi khi lưu cấu hình: ${error.message}`);
    }
};

/**
 * Delete office configuration and all related data
 * Removes all OfficeService entries and Counter entries for the office
 */
const deleteOfficeConfig = async (officeId) => {
    try {
        // Check if office exists
        const office = await TransactionOffice.findByPk(officeId);
        if (!office) {
            throw new Error(`Không tìm thấy phòng giao dịch với ID ${officeId}`);
        }

        // Get all service and service group IDs for this office
        const officeServices = await OfficeService.findAll({
            where: { transaction_office_id: officeId },
            raw: true,
        });
        const officeServiceGroups = await OfficeServiceGroup.findAll({
            where: { transaction_office_id: officeId },
            raw: true,
        });

        const serviceIds = officeServices.map(s => s.service_id);
        const groupIds = officeServiceGroups.map(g => g.service_group_id);

        // Check usage: Services in Kiosk (only kiosks in this office)
        if (serviceIds.length > 0) {
            const { Op } = require('sequelize');

            // Use raw query to check if service is used by kiosk in this office
            const kioskServices = await sequelize.query(
                `SELECT ks.* FROM kiosk_services ks
                 JOIN kiosks k ON ks.kiosk_id = k.id
                 WHERE ks.service_id IN (:serviceIds)
                 AND k.transaction_office_id = :officeId`,
                {
                    replacements: { serviceIds, officeId },
                    type: sequelize.QueryTypes.SELECT,
                }
            );
            if (kioskServices.length > 0) {
                const serviceList = officeServices
                    .map(s => s.service_id)
                    .join(', ');
                throw new Error(`Không thể xóa cấu hình: Dịch vụ (ID: ${serviceList}) đang được sử dụng bởi Kiosk`);
            }

            // Check usage: Services in Counter (only counters in this office)
            const counterServices = await sequelize.query(
                `SELECT cps.* FROM counter_priority_services cps
                 JOIN counters c ON cps.counter_id = c.id
                 WHERE cps.service_id IN (:serviceIds)
                 AND c.transaction_office_id = :officeId`,
                {
                    replacements: { serviceIds, officeId },
                    type: sequelize.QueryTypes.SELECT,
                }
            );
            if (counterServices.length > 0) {
                const serviceList = officeServices
                    .map(s => s.service_id)
                    .join(', ');
                throw new Error(`Không thể xóa cấu hình: Dịch vụ (ID: ${serviceList}) đang được sử dụng bởi Counter`);
            }
        }

        // Check usage: Service Groups in Kiosk (only kiosks in this office)
        if (groupIds.length > 0) {
            // Use raw query to check if service group is used by kiosk in this office
            const kioskGroups = await sequelize.query(
                `SELECT ksg.* FROM kiosk_service_groups ksg
                 JOIN kiosks k ON ksg.kiosk_id = k.id
                 WHERE ksg.service_group_id IN (:groupIds)
                 AND k.transaction_office_id = :officeId`,
                {
                    replacements: { groupIds, officeId },
                    type: sequelize.QueryTypes.SELECT,
                }
            );
            if (kioskGroups.length > 0) {
                const groupList = officeServiceGroups
                    .map(g => g.service_group_id)
                    .join(', ');
                throw new Error(`Không thể xóa cấu hình: Nhóm dịch vụ (ID: ${groupList}) đang được sử dụng bởi Kiosk`);
            }
        }

        // If no usage found, proceed with deletion
        const transaction = await sequelize.transaction();
        try {
            // Delete all office services
            await OfficeService.destroy({
                where: { transaction_office_id: officeId },
                transaction,
            });

            // Delete all office service groups
            await OfficeServiceGroup.destroy({
                where: { transaction_office_id: officeId },
                transaction,
            });

            await transaction.commit();
            return { success: true, message: 'Configuration deleted successfully' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        throw new Error(`Lỗi khi xóa cấu hình: ${error.message}`);
    }
};

module.exports = {
    getAllOfficeConfigs,
    getOfficeConfigDetails,
    saveOfficeConfig,
    deleteOfficeConfig,
    checkServiceUsageInDevices,
};
