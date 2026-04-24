const TicketFormat = require('../models/TicketFormat');
const Service = require('../models/Service');

/**
 * Get all ticket formats
 */
const getAllTicketFormats = async () => {
    try {
        const formats = await TicketFormat.findAll({
            order: [['created_at', 'DESC']],
        });
        return formats;
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách mẫu vé: ${error.message}`);
    }
};

/**
 * Get ticket format by ID
 */
const getTicketFormatById = async (id) => {
    try {
        const format = await TicketFormat.findByPk(id);
        if (!format) {
            throw new Error('Không tìm thấy mẫu vé');
        }
        return format;
    } catch (error) {
        throw new Error(`Lỗi khi tải mẫu vé: ${error.message}`);
    }
};

/**
 * Create new ticket format
 * Validation:
 * - code: required, unique
 * - template_format: required
 * - min_number: required, integer
 * - max_number: required, integer, must be > min_number
 */
const createTicketFormat = async (code, templateFormat, minNumber, maxNumber) => {
    try {
        // Validation
        if (!code || !templateFormat) {
            throw new Error('Mã và định dạng mẫu là bắt buộc');
        }

        if (!minNumber || !maxNumber || isNaN(minNumber) || isNaN(maxNumber)) {
            throw new Error('Số tối thiểu và số tối đa là bắt buộc và phải là số hợp lệ');
        }

        const min = parseInt(minNumber);
        const max = parseInt(maxNumber);

        if (min >= max) {
            throw new Error('Số tối thiểu phải nhỏ hơn số tối đa');
        }

        // Check if code already exists
        const existingFormat = await TicketFormat.findOne({
            where: { code: code }
        });

        if (existingFormat) {
            throw new Error(`Mã "${code}" đã tồn tại`);
        }

        // Create new ticket format
        const newFormat = await TicketFormat.create({
            code: code,
            template_format: templateFormat,
            min_number: min,
            max_number: max,
        });

        return newFormat;
    } catch (error) {
        throw new Error(`Lỗi khi tạo mẫu vé: ${error.message}`);
    }
};

/**
 * Update ticket format
 * Can update: template_format, min_number, max_number
 * Code should be read-only (but can validate if we allow updates)
 */
const updateTicketFormat = async (id, updateData) => {
    try {
        const format = await TicketFormat.findByPk(id);
        if (!format) {
            throw new Error('Không tìm thấy mẫu vé');
        }

        // Validation
        const { templateFormat, minNumber, maxNumber } = updateData;

        if (templateFormat && !templateFormat.trim()) {
            throw new Error('Định dạng mẫu không được để trống');
        }

        if (minNumber !== undefined && maxNumber !== undefined) {
            const min = parseInt(minNumber);
            const max = parseInt(maxNumber);

            if (isNaN(min) || isNaN(max)) {
                throw new Error('Số tối thiểu và số tối đa phải là số hợp lệ');
            }

            if (min >= max) {
                throw new Error('Số tối thiểu phải nhỏ hơn số tối đa');
            }
        }

        // Update fields
        if (templateFormat) {
            format.template_format = templateFormat;
        }
        if (minNumber !== undefined) {
            format.min_number = parseInt(minNumber);
        }
        if (maxNumber !== undefined) {
            format.max_number = parseInt(maxNumber);
        }

        await format.save();
        return format;
    } catch (error) {
        throw new Error(`Lỗi khi cập nhật mẫu vé: ${error.message}`);
    }
};

/**
 * Deactivate ticket format (Soft Delete)
 * Check if it's being used by active services first
 */
const deleteTicketFormat = async (id) => {
    try {
        const format = await TicketFormat.findByPk(id);
        if (!format) {
            throw new Error('Không tìm thấy mẫu vé');
        }

        // Check if this ticket format is used by any active service
        const usageCount = await Service.count({
            where: {
                ticket_format_id: id,
                is_active: true,
            }
        });

        if (usageCount > 0) {
            throw new Error('Không thể vô hiệu hóa Mẫu vé này vì đang được sử dụng bởi các Dịch vụ đang hoạt động. Vui lòng vô hiệu hóa dịch vụ trước.');
        }

        await format.update({ is_active: false });
        return { message: 'Vô hiệu hóa mẫu vé thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi vô hiệu hóa mẫu vé: ${error.message}`);
    }
};

/**
 * Reactivate ticket format
 */
const reactivateTicketFormat = async (id) => {
    try {
        const format = await TicketFormat.findByPk(id);
        if (!format) {
            throw new Error('Không tìm thấy mẫu vé');
        }

        await format.update({ is_active: true });
        return { message: 'Khôi phục mẫu vé thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi khôi phục mẫu vé: ${error.message}`);
    }
};

module.exports = {
    getAllTicketFormats,
    getTicketFormatById,
    createTicketFormat,
    updateTicketFormat,
    deleteTicketFormat,
    reactivateTicketFormat,
};
