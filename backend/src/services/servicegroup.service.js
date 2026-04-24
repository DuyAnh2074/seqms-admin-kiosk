const ServiceGroup = require('../models/ServiceGroup');
const ServiceGroupItem = require('../models/ServiceGroupItem');
const Service = require('../models/Service');
const OfficeService = require('../models/OfficeService');
const OfficeServiceGroup = require('../models/OfficeServiceGroup');
const KioskServiceGroup = require('../models/KioskServiceGroup');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

/**
 * Get all service groups with their associated services
 * @param {number} transactionOfficeId - Optional filter by office ID
 * @param {boolean} activeOnly - If true, only return service groups where is_active = true
 * @param {boolean} includeInactiveAssigned - If true (with transactionOfficeId), return active groups + inactive groups currently assigned to office
 */
const getAllServiceGroups = async (transactionOfficeId = null, activeOnly = false, includeInactiveAssigned = false) => {
    try {
        let whereClause = {};
        let officeGroupIds = [];

        if (transactionOfficeId) {
            // Get service groups for specific office from office_service_groups table
            const officeGroups = await OfficeServiceGroup.findAll({
                where: { transaction_office_id: transactionOfficeId },
                attributes: ['service_group_id'],
            });
            officeGroupIds = officeGroups.map(og => og.service_group_id);
        }

        // Filter by active status if requested (for Kiosk/Counter clients)
        if (activeOnly) {
            whereClause.is_active = true;
        }

        if (transactionOfficeId) {
            if (includeInactiveAssigned && !activeOnly) {
                // Office config screen: show all active groups,
                // and keep showing already-assigned inactive groups.
                whereClause = {
                    [Op.or]: [
                        { is_active: true },
                        { id: { [Op.in]: officeGroupIds.length > 0 ? officeGroupIds : [-1] } },
                    ],
                };
            } else {
                // Existing behavior: only groups assigned to the office
                if (officeGroupIds.length === 0) {
                    return [];
                }
                whereClause.id = { [Op.in]: officeGroupIds };
            }
        }

        const groups = await ServiceGroup.findAll({
            where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
            include: [
                {
                    model: Service,
                    as: 'Services',
                    through: { attributes: [] },
                    attributes: ['id', 'code', 'name', 'is_active'],
                    where: activeOnly ? { is_active: true } : undefined,
                    required: false,
                }
            ],
            order: [['id', 'ASC']],
        });

        // Map services to service_ids for frontend compatibility
        return groups.map(group => ({
            ...group.get({ plain: true }),
            service_ids: group.Services ? group.Services.map(s => s.id) : [],
            services: group.Services ? group.Services : []
        }));
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách nhóm dịch vụ: ${error.message}`);
    }
};

/**
 * Get service group by ID with associated services
 */
const getServiceGroupById = async (id) => {
    try {
        const group = await ServiceGroup.findByPk(id, {
            include: [
                {
                    model: Service,
                    as: 'Services',
                    through: { attributes: [] },
                    attributes: ['id', 'code', 'name', 'is_active'],
                    required: false,
                }
            ],
        });

        if (!group) {
            throw new Error('Không tìm thấy nhóm dịch vụ');
        }

        return {
            ...group.get({ plain: true }),
            service_ids: group.Services ? group.Services.map(s => s.id) : [],
            services: group.Services ? group.Services : []
        };
    } catch (error) {
        throw new Error(`Lỗi khi tải nhóm dịch vụ: ${error.message}`);
    }
};

/**
 * Create new service group with associated services
 * Transaction required for atomicity
 */
const createServiceGroup = async (data) => {
    const transaction = await sequelize.transaction();
    try {
        const { code, name, icon_url, service_ids } = data;

        // Insert into service_groups table
        const newGroup = await ServiceGroup.create(
            {
                code,
                name,
                icon_url: icon_url || null,
            },
            { transaction }
        );

        // Insert into service_group_items table (junction table)
        if (service_ids && service_ids.length > 0) {
            const groupItems = service_ids.map(service_id => ({
                service_group_id: newGroup.id,
                service_id: service_id,
            }));

            await ServiceGroupItem.bulkCreate(groupItems, { transaction });
        }

        await transaction.commit();

        return {
            ...newGroup.get({ plain: true }),
            service_ids: service_ids || []
        };
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Lỗi khi tạo nhóm dịch vụ: ${error.message}`);
    }
};

/**
 * Update service group and its services
 * Transaction required for atomicity
 */
const updateServiceGroup = async (id, data) => {
    const transaction = await sequelize.transaction();
    try {
        const { name, icon_url, service_ids } = data;

        // Check if group exists
        const group = await ServiceGroup.findByPk(id, { transaction });
        if (!group) {
            throw new Error('Không tìm thấy nhóm dịch vụ');
        }

        // Update service_groups table
        await group.update(
            {
                name,
                icon_url: icon_url || null,
            },
            { transaction }
        );

        // Delete all existing service_group_items for this group
        await ServiceGroupItem.destroy(
            {
                where: { service_group_id: id },
            },
            { transaction }
        );

        // Insert new service_group_items
        if (service_ids && service_ids.length > 0) {
            const groupItems = service_ids.map(service_id => ({
                service_group_id: id,
                service_id: service_id,
            }));

            await ServiceGroupItem.bulkCreate(groupItems, { transaction });
        }

        await transaction.commit();

        return {
            ...group.get({ plain: true }),
            service_ids: service_ids || []
        };
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Lỗi khi cập nhật nhóm dịch vụ: ${error.message}`);
    }
};

/**
 * Deactivate service group (Soft Delete)
 * Instead of deleting, set is_active = false
 * No dependency checks needed - configurations remain, but inactive groups are filtered in GET APIs
 */
const deleteServiceGroup = async (id) => {
    try {
        // Step 1: Check if service group exists
        const group = await ServiceGroup.findByPk(id);
        if (!group) {
            throw new Error('Không tìm thấy nhóm dịch vụ');
        }

        // Step 2: Soft delete - Set is_active = false
        await group.update({ is_active: false });

        return { id, message: 'Vô hiệu hóa nhóm dịch vụ thành công' };
    } catch (error) {
        throw new Error(error.message);
    }
};

/**
 * Reactivate service group
 * Set is_active = true to restore a deactivated service group
 */
const reactivateServiceGroup = async (id) => {
    try {
        const group = await ServiceGroup.findByPk(id);
        if (!group) {
            throw new Error('Không tìm thấy nhóm dịch vụ');
        }

        // Reactivate: Set is_active = true
        await group.update({ is_active: true });

        return { id, message: 'Khôi phục nhóm dịch vụ thành công' };
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = {
    getAllServiceGroups,
    getServiceGroupById,
    createServiceGroup,
    updateServiceGroup,
    deleteServiceGroup,
    reactivateServiceGroup,
};
