const Service = require('../models/Service');
const TicketFormat = require('../models/TicketFormat');
const ServiceGroupItem = require('../models/ServiceGroupItem');
const Transaction = require('../models/Transaction');
const OfficeService = require('../models/OfficeService');
const KioskService = require('../models/KioskService');
const CounterPriorityService = require('../models/CounterPriorityService');
const { Op } = require('sequelize');

/**
 * Get all services with ticket format details
 * @param {number} transactionOfficeId - Optional filter by office ID
 * @param {boolean} activeOnly - If true, only return services where is_active = true
 * @param {boolean} includeInactiveAssigned - If true (with transactionOfficeId), return active services + inactive services currently assigned to office
 */
const getAllServices = async (transactionOfficeId = null, activeOnly = false, includeInactiveAssigned = false) => {
    try {
        let whereClause = {};
        let officeServiceIds = [];

        if (transactionOfficeId) {
            const officeServices = await OfficeService.findAll({
                where: { transaction_office_id: transactionOfficeId },
                attributes: ['service_id'],
            });
            officeServiceIds = officeServices.map(os => os.service_id);
        }

        // Filter by active status if requested (for Kiosk/Counter clients)
        if (activeOnly) {
            whereClause.is_active = true;
        }

        if (transactionOfficeId) {
            if (includeInactiveAssigned && !activeOnly) {
                // Office config screen: show all active services,
                // and keep showing already-assigned inactive services.
                whereClause = {
                    [Op.or]: [
                        { is_active: true },
                        { id: { [Op.in]: officeServiceIds.length > 0 ? officeServiceIds : [-1] } },
                    ],
                };
            } else {
                // Existing behavior: only services assigned to the office
                whereClause.id = { [Op.in]: officeServiceIds.length > 0 ? officeServiceIds : [-1] };
            }
        }

        const services = await Service.findAll({
            where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
            include: [
                {
                    model: TicketFormat,
                    attributes: ['id', 'code', 'template_format'],
                    required: false,
                }
            ],
            order: [['created_at', 'DESC']],
        });
        return services;
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách dịch vụ: ${error.message}`);
    }
};

/**
 * Get service by ID with ticket format details
 */
const getServiceById = async (id) => {
    try {
        const service = await Service.findByPk(id, {
            include: [
                {
                    model: TicketFormat,
                    attributes: ['id', 'code', 'template_format'],
                    required: false,
                }
            ],
        });
        if (!service) {
            throw new Error('Không tìm thấy dịch vụ');
        }
        return service;
    } catch (error) {
        throw new Error(`Lỗi khi tải dịch vụ: ${error.message}`);
    }
};

/**
 * Create new service
 * Validation:
 * - code: required, unique
 * - name: required
 * - ticket_format_id: must exist in ticket_formats table
 */
const createService = async (code, name, ticketFormatId, iconUrl) => {
    try {
        // Validation
        if (!code || !name) {
            throw new Error('Mã và tên dịch vụ là bắt buộc');
        }

        // Check if code already exists
        const existingService = await Service.findOne({
            where: { code: code }
        });

        if (existingService) {
            throw new Error(`Mã "${code}" đã tồn tại`);
        }

        // Validate ticket_format_id exists (if provided)
        if (ticketFormatId) {
            const ticketFormat = await TicketFormat.findByPk(ticketFormatId);
            if (!ticketFormat) {
                throw new Error('Không tìm thấy mẫu vé');
            }
        }

        // Create new service
        const newService = await Service.create({
            code: code,
            name: name,
            ticket_format_id: ticketFormatId || null,
            icon_url: iconUrl || null,
        });

        // Return with ticket format details
        return await getServiceById(newService.id);
    } catch (error) {
        throw new Error(`Lỗi khi tạo dịch vụ: ${error.message}`);
    }
};

/**
 * Update service
 * Can update: name, ticket_format_id, icon_url
 * Cannot update: code
 */
const updateService = async (id, updateData) => {
    try {
        const service = await Service.findByPk(id);
        if (!service) {
            throw new Error('Không tìm thấy dịch vụ');
        }

        // Check if at least one field is provided
        if (!updateData.name && updateData.ticket_format_id === undefined && !updateData.icon_url) {
            throw new Error('Ít nhất một trường là bắt buộc để cập nhật');
        }

        // Validate ticket_format_id if provided
        if (updateData.ticket_format_id !== undefined && updateData.ticket_format_id !== null) {
            const ticketFormat = await TicketFormat.findByPk(updateData.ticket_format_id);
            if (!ticketFormat) {
                throw new Error('Không tìm thấy mẫu vé');
            }
        }

        // Update service
        if (updateData.name !== undefined) {
            service.name = updateData.name;
        }
        if (updateData.ticket_format_id !== undefined) {
            service.ticket_format_id = updateData.ticket_format_id;
        }
        if (updateData.icon_url !== undefined) {
            service.icon_url = updateData.icon_url;
        }

        await service.save();

        // Return with ticket format details
        return await getServiceById(service.id);
    } catch (error) {
        throw new Error(`Lỗi khi cập nhật dịch vụ: ${error.message}`);
    }
};

/**
 * Deactivate service (Soft Delete)
 * Instead of deleting, set is_active = false
 * No dependency checks needed - configurations remain, but inactive services are filtered out in GET APIs
 */
const deleteService = async (id) => {
    try {
        const service = await Service.findByPk(id);
        if (!service) {
            throw new Error('Không tìm thấy dịch vụ');
        }

        // Soft delete: Set is_active = false
        await service.update({ is_active: false });

        return {
            id,
            message: 'Vô hiệu hóa dịch vụ thành công'
        };
    } catch (error) {
        throw new Error(`Lỗi khi vô hiệu hóa dịch vụ: ${error.message}`);
    }
};

/**
 * Reactivate service
 * Set is_active = true to restore a deactivated service
 */
const reactivateService = async (id) => {
    try {
        const service = await Service.findByPk(id);
        if (!service) {
            throw new Error('Không tìm thấy dịch vụ');
        }

        // Reactivate: Set is_active = true
        await service.update({ is_active: true });

        return {
            id,
            message: 'Khôi phục dịch vụ thành công'
        };
    } catch (error) {
        throw new Error(`Lỗi khi khôi phục dịch vụ: ${error.message}`);
    }
};

module.exports = {
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    reactivateService,
};
