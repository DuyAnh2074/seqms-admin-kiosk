const { Kiosk, TransactionOffice, Service, ServiceGroup, ServiceGroupItem, KioskService, KioskServiceGroup } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { emitKioskStateChanged } = require('../socket');

const OFFICE_REACTIVATE_GUARD_MESSAGE = 'Không thể khôi phục thiết bị/nhân viên này vì Phòng Giao Dịch trực thuộc đang bị vô hiệu hóa. Vui lòng khôi phục Phòng Giao Dịch trước.';

/**
 * Get all kiosks with relationships
 * Returns formatted kiosks with service groups and services
 */
const getAllKiosks = async () => {
    try {
        const kiosks = await Kiosk.findAll({
            include: [
                {
                    model: TransactionOffice,
                    attributes: ['id', 'name', 'code'],
                    as: 'TransactionOffice',
                },
                {
                    model: Service,
                    attributes: ['id', 'name', 'code'],
                    as: 'Services',
                    through: { attributes: [] },
                },
                {
                    model: ServiceGroup,
                    attributes: ['id', 'name', 'code'],
                    as: 'ServiceGroups',
                    through: { attributes: [] },
                },
            ],
            order: [['id', 'DESC']],
            raw: false,
        });

        // Format dữ liệu với chuỗi nối các tên nhóm và dịch vụ
        const formattedKiosks = kiosks.map(kiosk => {
            const groupNames = kiosk.ServiceGroups && kiosk.ServiceGroups.length > 0
                ? kiosk.ServiceGroups.map(sg => sg.name).join(', ')
                : '';
            const serviceNames = kiosk.Services && kiosk.Services.length > 0
                ? kiosk.Services.map(s => s.name).join(', ')
                : '';

            // Combine both with separator if both exist
            let combinedDisplay = '';
            if (groupNames && serviceNames) {
                combinedDisplay = `${groupNames} | ${serviceNames}`;
            } else if (groupNames) {
                combinedDisplay = groupNames;
            } else if (serviceNames) {
                combinedDisplay = serviceNames;
            } else {
                combinedDisplay = 'N/A';
            }

            return {
                id: kiosk.id,
                name: kiosk.name,
                code: kiosk.code,
                ip_address: kiosk.ip_address,
                status: kiosk.status,
                is_active: kiosk.is_active,
                location: kiosk.TransactionOffice?.name || 'N/A',
                locationId: kiosk.transaction_office_id,
                serviceGroupIds: kiosk.ServiceGroups ? kiosk.ServiceGroups.map(sg => sg.id) : [],
                serviceIds: kiosk.Services ? kiosk.Services.map(s => s.id) : [],
                serviceDisplay: combinedDisplay,
                createdDate: kiosk.created_at ? new Date(kiosk.created_at).toLocaleDateString('vi-VN') : 'N/A',
            };
        });

        return formattedKiosks;
    } catch (error) {
        throw new Error(`Failed to fetch kiosks: ${error.message}`);
    }
};

/**
 * Get kiosk by ID with relationships
 */
const getKioskById = async (id) => {
    try {
        const kiosk = await Kiosk.findByPk(id, {
            include: [
                {
                    model: TransactionOffice,
                    attributes: ['id', 'name'],
                    as: 'TransactionOffice',
                },
                {
                    model: Service,
                    attributes: ['id', 'name'],
                    as: 'Services',
                    through: { attributes: [] },
                },
                {
                    model: ServiceGroup,
                    attributes: ['id', 'name'],
                    as: 'ServiceGroups',
                    through: { attributes: [] },
                },
            ],
        });

        if (!kiosk) {
            throw new Error('Kiosk không tồn tại');
        }

        return kiosk;
    } catch (error) {
        throw new Error(`Failed to fetch kiosk: ${error.message}`);
    }
};

/**
 * Create new kiosk with service groups and services
 * Validation:
 * - transaction_office_id, name, code: required
 * - code: unique
 * - At least one of service_group_ids or service_ids must be provided
 */
const createKiosk = async (kioskData) => {
    const transaction = await sequelize.transaction();

    try {
        const { transaction_office_id, service_group_ids = [], service_ids = [], name, code } = kioskData;

        // Validation - require office_id, name, code
        if (!transaction_office_id || !name || !code) {
            throw new Error('Các trường bắt buộc không được để trống');
        }

        // Validate at least one of service_group_ids or service_ids must be provided
        if (service_group_ids.length === 0 && service_ids.length === 0) {
            throw new Error('Vui lòng chọn ít nhất một Nhóm dịch vụ hoặc Dịch vụ');
        }

        // Kiểm tra code duy nhất
        const existingKiosk = await Kiosk.findOne({ where: { code } });
        if (existingKiosk) {
            throw new Error(`Kiosk với code "${code}" đã tồn tại`);
        }

        // Kiểm tra transaction_office_id hợp lệ
        const office = await TransactionOffice.findByPk(transaction_office_id);
        if (!office) {
            throw new Error('Phòng giao dịch không tồn tại');
        }

        // Kiểm tra service_group_ids hợp lệ (nếu có)
        if (service_group_ids && service_group_ids.length > 0) {
            for (const sgId of service_group_ids) {
                const serviceGroup = await ServiceGroup.findByPk(sgId);
                if (!serviceGroup) {
                    throw new Error(`Nhóm dịch vụ với ID ${sgId} không tồn tại`);
                }
            }
        }

        // Kiểm tra service_ids hợp lệ (nếu có)
        if (service_ids && service_ids.length > 0) {
            for (const sId of service_ids) {
                const service = await Service.findByPk(sId);
                if (!service) {
                    throw new Error(`Dịch vụ với ID ${sId} không tồn tại`);
                }
            }
        }

        // Tạo kiosk mới
        const newKiosk = await Kiosk.create({
            transaction_office_id,
            name,
            code,
            ip_address: null,
            status: 'active',
            is_active: true,
        }, { transaction });

        // Thêm relationships vào junction tables
        if (service_group_ids && service_group_ids.length > 0) {
            const groupRecords = service_group_ids.map(sgId => ({
                kiosk_id: newKiosk.id,
                service_group_id: sgId,
            }));
            await KioskServiceGroup.bulkCreate(groupRecords, { transaction });
        }

        if (service_ids && service_ids.length > 0) {
            const serviceRecords = service_ids.map(sId => ({
                kiosk_id: newKiosk.id,
                service_id: sId,
            }));
            await KioskService.bulkCreate(serviceRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Return created kiosk with relationships
        return await getKioskById(newKiosk.id);
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to create kiosk: ${error.message}`);
    }
};

/**
 * Update kiosk
 * Can update: transaction_office_id, name, code, service_group_ids, service_ids
 */
const updateKiosk = async (id, kioskData) => {
    const transaction = await sequelize.transaction();

    try {
        const { transaction_office_id, service_group_ids = [], service_ids = [], name, code } = kioskData;

        // Kiểm tra kiosk tồn tại
        const kiosk = await Kiosk.findByPk(id);
        if (!kiosk) {
            throw new Error('Kiosk không tồn tại');
        }

        // Validation - require office_id, name, code
        if (!transaction_office_id || !name || !code) {
            throw new Error('Các trường bắt buộc không được để trống');
        }

        // Validate at least one of service_group_ids or service_ids must be provided
        if (service_group_ids.length === 0 && service_ids.length === 0) {
            throw new Error('Vui lòng chọn ít nhất một Nhóm dịch vụ hoặc Dịch vụ');
        }

        // Kiểm tra code duy nhất (nếu code thay đổi)
        if (code !== kiosk.code) {
            const existingCode = await Kiosk.findOne({ where: { code } });
            if (existingCode) {
                throw new Error(`Kiosk với code "${code}" đã tồn tại`);
            }
        }

        // Kiểm tra transaction_office_id hợp lệ
        const office = await TransactionOffice.findByPk(transaction_office_id);
        if (!office) {
            throw new Error('Phòng giao dịch không tồn tại');
        }

        // Kiểm tra service_group_ids hợp lệ (nếu có)
        if (service_group_ids && service_group_ids.length > 0) {
            for (const sgId of service_group_ids) {
                const serviceGroup = await ServiceGroup.findByPk(sgId);
                if (!serviceGroup) {
                    throw new Error(`Nhóm dịch vụ với ID ${sgId} không tồn tại`);
                }
            }
        }

        // Kiểm tra service_ids hợp lệ (nếu có)
        if (service_ids && service_ids.length > 0) {
            for (const sId of service_ids) {
                const service = await Service.findByPk(sId);
                if (!service) {
                    throw new Error(`Dịch vụ với ID ${sId} không tồn tại`);
                }
            }
        }

        // Cập nhật kiosk basic info
        await kiosk.update({
            transaction_office_id,
            name,
            code,
        }, { transaction });

        // Xóa tất cả relationships cũ
        await KioskServiceGroup.destroy({ where: { kiosk_id: id }, transaction });
        await KioskService.destroy({ where: { kiosk_id: id }, transaction });

        // Thêm relationships mới vào junction tables
        if (service_group_ids && service_group_ids.length > 0) {
            const groupRecords = service_group_ids.map(sgId => ({
                kiosk_id: kiosk.id,
                service_group_id: sgId,
            }));
            await KioskServiceGroup.bulkCreate(groupRecords, { transaction });
        }

        if (service_ids && service_ids.length > 0) {
            const serviceRecords = service_ids.map(sId => ({
                kiosk_id: kiosk.id,
                service_id: sId,
            }));
            await KioskService.bulkCreate(serviceRecords, { transaction });
        }

        // Commit transaction
        await transaction.commit();

        // Return updated kiosk with relationships
        return await getKioskById(id);
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to update kiosk: ${error.message}`);
    }
};

/**
 * Deactivate kiosk (Soft Delete)
 */
const deleteKiosk = async (id) => {
    try {
        const kiosk = await Kiosk.findByPk(id);
        if (!kiosk) {
            throw new Error('Kiosk không tồn tại');
        }

        await kiosk.update({
            is_active: false,
            status: 'inactive',
        });

        emitKioskStateChanged({
            id: kiosk.id,
            code: kiosk.code,
            name: kiosk.name,
            transaction_office_id: kiosk.transaction_office_id,
            is_active: false,
            status: 'inactive',
            message: 'Kiosk tạm ngưng hoạt động',
        });

        return { id, message: 'Kiosk đã được vô hiệu hóa thành công' };
    } catch (error) {
        throw new Error(`Failed to deactivate kiosk: ${error.message}`);
    }
};

/**
 * Reactivate kiosk
 */
const reactivateKiosk = async (id) => {
    try {
        const kiosk = await Kiosk.findByPk(id);
        if (!kiosk) {
            throw new Error('Kiosk không tồn tại');
        }

        const office = await TransactionOffice.findByPk(kiosk.transaction_office_id, {
            attributes: ['id', 'is_active'],
        });

        if (!office || office.is_active === false) {
            const error = new Error(OFFICE_REACTIVATE_GUARD_MESSAGE);
            error.statusCode = 400;
            throw error;
        }

        await kiosk.update({
            is_active: true,
            status: 'active',
        });

        emitKioskStateChanged({
            id: kiosk.id,
            code: kiosk.code,
            name: kiosk.name,
            transaction_office_id: kiosk.transaction_office_id,
            is_active: true,
            status: 'active',
            message: 'Kiosk đã hoạt động trở lại',
        });

        return { id, message: 'Kiosk đã được khôi phục thành công' };
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }
        throw new Error(`Failed to reactivate kiosk: ${error.message}`);
    }
};

/**
 * Get kiosk services by code (for kiosk client)
 * Returns nested structure: Kiosk -> Service Groups -> Services + Direct Services
 */
const getKioskServicesByCode = async (code) => {
    try {
        if (!code) {
            throw new Error('Vui lòng cung cấp kiosk code');
        }

        // Tìm kiosk đang hoạt động
        const kiosk = await Kiosk.findOne({
            where: { code, status: 'active', is_active: true },
            include: [
                {
                    model: TransactionOffice,
                    attributes: ['id', 'name', 'code', 'is_active'],
                    as: 'TransactionOffice',
                },
                {
                    model: ServiceGroup,
                    attributes: ['id', 'name', 'code'],
                    as: 'ServiceGroups',
                    where: { is_active: true },
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Service,
                    attributes: ['id', 'name', 'code', 'icon_url'],
                    as: 'Services',
                    where: { is_active: true },
                    through: { attributes: [] },
                    required: false,
                },
            ],
        });

        if (!kiosk) {
            throw new Error('Kiosk không tồn tại hoặc đã bị vô hiệu hóa');
        }

        if (!kiosk.TransactionOffice || kiosk.TransactionOffice.is_active === false) {
            const officeError = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
            officeError.statusCode = 403;
            throw officeError;
        }

        // Build nested service_group structure with services
        const serviceGroups = [];

        // 1. Add services from service groups
        if (kiosk.ServiceGroups && kiosk.ServiceGroups.length > 0) {
            for (const group of kiosk.ServiceGroups) {
                const groupItems = await ServiceGroupItem.findAll({
                    where: { service_group_id: group.id },
                    include: [
                        {
                            model: ServiceGroup,
                            as: 'ServiceGroup',
                            attributes: ['id'],
                            where: { is_active: true },
                            required: true,
                        },
                        {
                            model: Service,
                            attributes: ['id', 'name', 'code', 'icon_url'],
                            as: 'Service',
                            where: { is_active: true },
                            required: true,
                        },
                    ],
                    raw: false,
                });

                // Sort by Service ID descending (newer services first)
                const sortedGroupItems = groupItems.sort((a, b) => b.service_id - a.service_id);

                const services = sortedGroupItems.map(item => ({
                    id: item.Service.id,
                    vn_name: item.Service.name,
                    code: item.Service.code,
                    icon_url: item.Service.icon_url || null,
                }));

                serviceGroups.push({
                    id: group.id,
                    vn_name: group.name,
                    code: group.code,
                    services: services,
                });
            }
        }

        // 2. Get direct services (not in any group)
        const directServices = kiosk.Services && kiosk.Services.length > 0
            ? kiosk.Services.map(service => ({
                id: service.id,
                vn_name: service.name,
                code: service.code,
                icon_url: service.icon_url || null,
            }))
            : [];

        return {
            id: kiosk.id,
            code: kiosk.code,
            name: kiosk.name,
            branch_name: kiosk.TransactionOffice?.name || 'N/A',
            services: directServices, // Direct services at the same level
            service_group: serviceGroups,
        };
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }
        throw new Error(`Failed to fetch kiosk services: ${error.message}`);
    }
};

module.exports = {
    getAllKiosks,
    getKioskById,
    createKiosk,
    updateKiosk,
    deleteKiosk,
    reactivateKiosk,
    getKioskServicesByCode,
};
